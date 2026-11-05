import {
  USDC_DECIMALS,
  type Address,
  type AllowanceState,
  type Amount,
  type ChainId,
  type PayIntent,
  type RejectCode,
  type TxId,
} from '@agentguard/shared'
import {
  getAccount,
  getAssociatedTokenAddressSync,
  TokenAccountNotFoundError,
} from '@solana/spl-token'
import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type Connection,
  type VersionedMessage,
} from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import type { PaymentRequirements, SchemeNetworkClient } from '@x402/core/types'
import {
  SigningRefused,
  type ChainAdapter,
  type KillTx,
  type SimulationOutcome,
} from '../ChainAdapter.js'
import { inspectTransfer } from './inspect.js'
import { simulateMessage, topUpFor } from './simulate.js'
import { confirm, connect, readSpendingLimit, spendingLimitPda } from './squads.js'
import { useSpendingLimit } from './draw.js'
import { expectedTransfer, transferInstructions, type Payment } from './transfer.js'
import { gatedScheme } from './x402.js'

export interface SvmAdapterDeps {
  chain: ChainId
  connection: Connection
  /** Held by guard-core alone. The adapter signs with it and never exposes it. */
  hotWallet: Keypair
  multisigPda: PublicKey
  mint: PublicKey
}

/** An x402 payment someone else built, as guard-core sees it before signing. */
export interface ForeignPayment {
  /** The base64 wire transaction from the x402 payload. */
  transaction: string
  recipient: Address
  amount: Amount
  /** The facilitator named in the payment requirements. */
  feePayer: Address
}

export interface SvmAdapter extends ChainAdapter {
  checkPayment(payment: ForeignPayment): Promise<SimulationOutcome>
}

/** The same adapter, from plain values, so guard-core never handles a Solana SDK type. */
export function createSvmAdapter(config: {
  chain: ChainId
  rpcUrl: string
  /** The 64-byte secret key, as solana-keygen writes it. */
  hotWalletSecretKey: Uint8Array
  multisig: Address
  mint: Address
}): SvmAdapter {
  return svmAdapter({
    chain: config.chain,
    connection: connect(config.rpcUrl),
    hotWallet: Keypair.fromSecretKey(config.hotWalletSecretKey),
    multisigPda: new PublicKey(config.multisig),
    mint: new PublicKey(config.mint),
  })
}

const NOT_SIMULATED = { summary: 'not simulated', balanceChanges: [] }

const notSimulated = (error: unknown): SimulationOutcome => ({
  simulation: {
    summary: `not simulated: ${error instanceof Error ? error.message : String(error)}`,
    balanceChanges: [],
  },
  rejectReasons: ['SIM_FAILED'],
})

function atomic(amount: Amount): bigint {
  if (!/^[1-9]\d*$/.test(amount)) {
    throw new Error(`invalid_amount: ${amount}`)
  }
  return BigInt(amount)
}

export function svmAdapter(deps: SvmAdapterDeps): SvmAdapter {
  const { chain, connection, hotWallet, multisigPda, mint } = deps
  const limit = spendingLimitPda(multisigPda, hotWallet.publicKey)
  const draw = { multisigPda, spendingLimit: limit, mint, member: hotWallet.publicKey }

  function payment(recipient: Address, amount: Amount, feePayer = hotWallet.publicKey): Payment {
    return {
      feePayer,
      hotWallet: hotWallet.publicKey,
      recipient: new PublicKey(recipient),
      mint,
      amount: atomic(amount),
      decimals: USDC_DECIMALS,
    }
  }

  /** Reasons this adapter cannot pay the intent at all, before any transaction exists. */
  function refuse(intent: PayIntent): RejectCode[] {
    if (intent.chain !== chain) {
      return ['CHAIN_NOT_ALLOWED']
    }
    if (intent.token !== mint.toBase58()) {
      return ['TOKEN_NOT_ALLOWED']
    }
    return []
  }

  async function message(pay: Payment): Promise<VersionedMessage> {
    const { blockhash } = await connection.getLatestBlockhash()
    const destination = await connection.getAccountInfo(expectedTransfer(pay).destination)
    return new TransactionMessage({
      payerKey: pay.feePayer,
      recentBlockhash: blockhash,
      instructions: transferInstructions(pay, destination === null),
    }).compileToV0Message()
  }

  return {
    chain,

    async getAllowanceState(): Promise<AllowanceState> {
      const { cap, spent, resetsAt } = await readSpendingLimit(connection, limit)
      return { cap, spent, resetsAt, delegate: hotWallet.publicKey.toBase58() }
    },

    async getHotWalletBalance(token: Address): Promise<Amount> {
      const address = getAssociatedTokenAddressSync(new PublicKey(token), hotWallet.publicKey)
      try {
        return (await getAccount(connection, address)).amount.toString()
      } catch (error) {
        // A wallet that never held the token has no account for it, which is a balance of zero.
        if (error instanceof TokenAccountNotFoundError) {
          return '0'
        }
        throw error
      }
    },

    async topUpHotWallet(amount: Amount): Promise<TxId> {
      return useSpendingLimit(connection, hotWallet, {
        multisigPda,
        spendingLimit: limit,
        mint,
        amount: atomic(amount),
        decimals: USDC_DECIMALS,
      })
    },

    async simulate(intent: PayIntent): Promise<SimulationOutcome> {
      const refused = refuse(intent)
      if (refused.length > 0) {
        return { simulation: NOT_SIMULATED, rejectReasons: refused }
      }
      let pay: Payment
      try {
        pay = payment(intent.recipient, intent.amount)
      } catch (error) {
        return notSimulated(error)
      }
      return simulateMessage(
        connection,
        await message(pay),
        pay,
        await topUpFor(connection, draw, pay.amount),
      )
    },

    async checkPayment(foreign: ForeignPayment): Promise<SimulationOutcome> {
      let pay: Payment
      let received: VersionedMessage
      try {
        pay = payment(foreign.recipient, foreign.amount, new PublicKey(foreign.feePayer))
        // web3.js v1 reads legacy and v0 only, so a v1 transaction lands here and is refused.
        received = VersionedTransaction.deserialize(
          Buffer.from(foreign.transaction, 'base64'),
        ).message
      } catch (error) {
        return notSimulated(error)
      }
      return simulateMessage(
        connection,
        received,
        pay,
        await topUpFor(connection, draw, pay.amount),
      )
    },

    async send(intent: PayIntent): Promise<TxId> {
      const refused = refuse(intent)
      if (refused.length > 0) {
        throw new Error(`send_refused: ${refused.join(',')}`)
      }
      const pay = payment(intent.recipient, intent.amount)
      const built = await message(pay)
      // Rebuilt with a fresh blockhash since simulate ran, so it is inspected again: what is signed
      // is what was checked.
      const reasons = inspectTransfer(built, expectedTransfer(pay))
      if (reasons.length > 0) {
        throw new Error(`send_refused: ${reasons.join(',')}`)
      }
      const tx = new VersionedTransaction(built)
      tx.sign([hotWallet])
      return confirm(connection, await connection.sendRawTransaction(tx.serialize()))
    },

    x402Scheme(intent: PayIntent, requirements: PaymentRequirements): SchemeNetworkClient {
      const refused = refuse(intent)
      if (refused.length > 0) {
        throw new SigningRefused(refused)
      }
      // The intent is what the policy approved; requirements that disagree with it are a 402 that
      // changed between the quote and the signature.
      const feePayer = requirements.extra['feePayer']
      const agreed =
        requirements.network === intent.chain &&
        requirements.asset === intent.token &&
        requirements.payTo === intent.recipient &&
        requirements.amount === intent.amount
      if (!agreed || typeof feePayer !== 'string') {
        throw new SigningRefused(['INVALID_402'])
      }
      let pay: Payment
      try {
        pay = payment(intent.recipient, intent.amount, new PublicKey(feePayer))
      } catch {
        throw new SigningRefused(['INVALID_402'])
      }
      const gate = async (received: VersionedMessage) =>
        (await simulateMessage(connection, received, pay)).rejectReasons
      return gatedScheme(hotWallet, gate, connection.rpcEndpoint)
    },

    async buildKillTx(): Promise<KillTx> {
      const { configAuthority } = await multisig.accounts.Multisig.fromAccountAddress(
        connection,
        multisigPda,
      )
      // An autonomous multisig has no config authority and changes only through a proposal, which
      // a single instruction cannot express.
      if (configAuthority.equals(PublicKey.default)) {
        throw new Error(`multisig_not_controlled: ${multisigPda.toBase58()}`)
      }
      const instruction = multisig.instructions.multisigRemoveSpendingLimit({
        multisigPda,
        configAuthority,
        spendingLimit: limit,
        rentCollector: configAuthority,
      })
      return {
        description:
          `Remove spending limit ${limit.toBase58()} from Squads multisig ${multisigPda.toBase58()}. ` +
          `The hot wallet ${hotWallet.publicKey.toBase58()} loses all access to the vault until a ` +
          `new limit is added. Sign as the config authority ${configAuthority.toBase58()}.`,
        // An instruction rather than a transaction: a blockhash would expire long before the owner
        // gets to sign on their phone.
        payload: {
          signer: configAuthority.toBase58(),
          programId: instruction.programId.toBase58(),
          accounts: instruction.keys.map((key) => ({
            pubkey: key.pubkey.toBase58(),
            isSigner: key.isSigner,
            isWritable: key.isWritable,
          })),
          data: instruction.data.toString('base64'),
        },
      }
    },
  }
}
