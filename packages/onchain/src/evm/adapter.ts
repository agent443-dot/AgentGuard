import {
  usdSymbol,
  type Address as TokenAddress,
  type AllowanceState,
  type Amount,
  type ChainId,
  type PayIntent,
  type RejectCode,
  type TxId,
} from '@agentguard/shared'
import type { PaymentRequirements, SchemeNetworkClient } from '@x402/core/types'
import { ExactEvmScheme } from '@x402/evm'
import { privateKeyToAccount } from 'viem/accounts'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  isAddressEqual,
  parseEventLogs,
  type Account,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from 'viem'
import {
  SigningRefused,
  type ChainAdapter,
  type KillTx,
  type SimulationOutcome,
} from '../ChainAdapter.js'
import { chainOf, type EvmChainId } from './config.js'
import { hotWalletGas } from './gas.js'
import { checkTypedData } from './gate.js'
import { allowanceModuleAbi, hasAllowance, readAllowance } from './safe.js'
import { erc20Abi, simulatePayment, topUpData } from './simulate.js'
import { TOKEN_DOMAINS } from './tokens.js'

export interface EvmAdapterDeps {
  chain: ChainId
  client: PublicClient
  /** Holds the hot wallet account; guard-core alone has its key. */
  wallet: WalletClient & { account: Account }
  safe: Address
  usdc: Address
  module: Address
  /** Unix seconds; injectable so the signing gate can be tested at a fixed time. */
  now?: () => bigint
}

/** The same adapter from plain values, so guard-core never handles a viem type. */
export function createEvmAdapter(config: {
  chain: EvmChainId
  rpcUrl: string
  hotWalletKey: Hash
  safe: string
  usdc: string
  module: string
}): ChainAdapter {
  const chain = chainOf(config.chain)
  const transport = http(config.rpcUrl)
  return evmAdapter({
    chain: `eip155:${config.chain}`,
    client: createPublicClient({ chain, transport }) as PublicClient,
    wallet: createWalletClient({
      account: privateKeyToAccount(config.hotWalletKey),
      chain,
      transport,
    }),
    safe: getAddress(config.safe),
    usdc: getAddress(config.usdc),
    module: getAddress(config.module),
  })
}

const NOT_SIMULATED = { summary: 'not simulated', balanceChanges: [] }

const notSimulated = (why: string): SimulationOutcome => ({
  simulation: { summary: `not simulated: ${why}`, balanceChanges: [] },
  rejectReasons: ['SIM_FAILED'],
})

function atomic(amount: Amount): bigint {
  if (!/^[1-9]\d*$/.test(amount)) {
    throw new Error(`invalid_amount: ${amount}`)
  }
  return BigInt(amount)
}

export function evmAdapter(deps: EvmAdapterDeps): ChainAdapter {
  const { chain, client, wallet, safe, usdc, module } = deps
  const hot = wallet.account.address
  const now = deps.now ?? (() => BigInt(Math.floor(Date.now() / 1000)))

  function refuse(intent: PayIntent): RejectCode[] {
    if (intent.chain !== chain) {
      return ['CHAIN_NOT_ALLOWED']
    }
    if (!isAddress(intent.token) || getAddress(intent.token) !== usdc) {
      return ['TOKEN_NOT_ALLOWED']
    }
    return []
  }

  async function settled(hash: Hash) {
    const receipt = await client.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`transaction_failed: ${hash}`)
    }
    return receipt
  }

  const confirmed = async (hash: Hash): Promise<TxId> => (await settled(hash)).transactionHash

  return {
    chain,

    async getAllowanceState(): Promise<AllowanceState> {
      const state = await readAllowance(client, module, safe, hot, usdc)
      if (!(await hasAllowance(client, module, safe, hot, state))) {
        return { status: 'none', delegate: hot }
      }
      const resetsAtMin = state.lastResetMin + state.resetTimeMin
      return {
        status: 'active',
        cap: state.amount.toString(),
        spent: state.spent.toString(),
        resetsAt: new Date(Number(resetsAtMin) * 60_000).toISOString(),
        delegate: hot,
      }
    },

    async getHotWalletBalance(token: TokenAddress): Promise<Amount> {
      const balance = await client.readContract({
        address: getAddress(token),
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [hot],
      })
      return balance.toString()
    },

    getHotWalletGas: () => hotWalletGas(client, hot),

    async topUpHotWallet(amount: Amount): Promise<TxId> {
      const hash = await wallet.sendTransaction({
        chain: client.chain,
        account: wallet.account,
        to: module,
        data: topUpData({ safe, hot, usdc, module }, atomic(amount)),
      })
      return confirmed(hash)
    },

    async simulate(intent: PayIntent): Promise<SimulationOutcome> {
      const refused = refuse(intent)
      if (refused.length > 0) {
        return { simulation: NOT_SIMULATED, rejectReasons: refused }
      }
      if (!isAddress(intent.recipient)) {
        return notSimulated(`the recipient ${intent.recipient} is not an EVM address`)
      }
      let amount: bigint
      try {
        amount = atomic(intent.amount)
      } catch {
        return notSimulated(`the amount ${intent.amount} is not a positive integer`)
      }
      return simulatePayment(
        client,
        { symbol: usdSymbol(chain) ?? 'USD', safe, hot, usdc, module },
        getAddress(intent.recipient),
        amount,
      )
    },

    async send(intent: PayIntent): Promise<TxId> {
      const refused = refuse(intent)
      if (refused.length > 0) {
        throw new Error(`send_refused: ${refused.join(',')}`)
      }
      if (!isAddress(intent.recipient)) {
        throw new Error(`send_refused: SIM_FAILED`)
      }
      const to = getAddress(intent.recipient)
      const amount = atomic(intent.amount)
      const hash = await wallet.writeContract({
        chain: client.chain,
        account: wallet.account,
        address: usdc,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to, amount],
      })
      const receipt = await settled(hash)
      // The proof of payment is the token's own Transfer event, not the receipt's status alone: a
      // token can succeed while moving something other than what was asked.
      const paid = parseEventLogs({
        abi: erc20Abi,
        eventName: 'Transfer',
        logs: receipt.logs,
      }).some(
        (log) =>
          isAddressEqual(log.address, usdc) &&
          isAddressEqual(log.args.from, hot) &&
          isAddressEqual(log.args.to, to) &&
          log.args.value === amount,
      )
      if (!paid) {
        throw new Error(`payment_unproven: ${hash} has no Transfer of ${amount} to ${to}`)
      }
      return hash
    },

    async buildKillTx(): Promise<KillTx> {
      // removeDelegate with removeAllowances = true deletes the allowance too, so one call does both.
      const data = encodeFunctionData({
        abi: allowanceModuleAbi,
        functionName: 'removeDelegate',
        args: [hot, true],
      })
      return {
        description:
          `Remove the hot wallet ${hot} as Allowance Module delegate on Safe ${safe}, with its ` +
          `allowances. It can no longer draw from the Safe until a new allowance is set. Sign as a ` +
          `Safe owner.`,
        payload: { safe, to: module, value: '0', data, operation: 0 },
      }
    },

    x402Scheme(intent: PayIntent, requirements: PaymentRequirements): SchemeNetworkClient {
      const refused = refuse(intent)
      if (refused.length > 0) {
        throw new SigningRefused(refused)
      }
      const agreed =
        requirements.network === intent.chain &&
        isAddress(requirements.asset) &&
        getAddress(requirements.asset) === usdc &&
        isAddress(requirements.payTo) &&
        isAddress(intent.recipient) &&
        getAddress(requirements.payTo) === getAddress(intent.recipient) &&
        requirements.amount === intent.amount
      if (!agreed) {
        throw new SigningRefused(['INVALID_402'])
      }
      const domain = TOKEN_DOMAINS[chain]
      if (!domain) {
        throw new SigningRefused(['TOKEN_NOT_ALLOWED'])
      }
      const expected = {
        chainId: Number(chain.split(':')[1]),
        usdc,
        domain,
        from: hot,
        to: getAddress(intent.recipient),
        value: atomic(intent.amount),
      }
      // Only typed-data signing is offered: no transaction signer and no EIP-7702 authorization, so
      // the SDK's approval and delegation paths have nothing to sign with.
      return new ExactEvmScheme({
        address: hot,
        async signTypedData(typed) {
          const checked = checkTypedData(typed, { ...expected, now: now() })
          if (Array.isArray(checked)) {
            throw new SigningRefused(checked)
          }
          return wallet.signTypedData({ ...checked, account: wallet.account })
        },
      })
    },
  }
}
