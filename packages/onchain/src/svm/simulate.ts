import { USDC_DECIMALS, type SimulationResult } from '@agentguard/shared'
import { TOKEN_PROGRAM_ID, unpackAccount, type Account } from '@solana/spl-token'
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
  type AccountInfo,
  type Connection,
  type SimulatedTransactionAccountInfo,
  type VersionedMessage,
} from '@solana/web3.js'
import type { SimulationOutcome } from '../ChainAdapter.js'
import { inspectTransfer } from './inspect.js'
import { drawInstructions, hotTokenAccount, vaultTokenAccount, type Draw } from './squads.js'
import { checkEffects, expectedTransfer, formatUnits, type Payment } from './transfer.js'

/** The draw on the spending limit that guard-core will make before paying, when the hot wallet is short. */
export interface TopUp {
  instructions: TransactionInstruction[]
  /** The vault's token account, which must fall by exactly the amount. */
  vault: PublicKey
  amount: bigint
}

/**
 * The draw guard-core will make before paying `amount`, if the hot wallet holds less than that.
 * A hot wallet that never held the token gets its token account created by the draw.
 */
export async function topUpFor(
  connection: Connection,
  draw: Omit<Draw, 'amount' | 'decimals' | 'createAccount'>,
  amount: bigint,
): Promise<TopUp | undefined> {
  const account = hotTokenAccount(draw.mint, draw.member)
  const info = await connection.getAccountInfo(account)
  const held = info ? unpackAccount(account, info).amount : 0n
  if (held >= amount) {
    return undefined
  }
  const shortfall = amount - held
  const instructions = drawInstructions({
    ...draw,
    amount: shortfall,
    decimals: USDC_DECIMALS,
    createAccount: info === null,
  })
  return { instructions, vault: vaultTokenAccount(draw.multisigPda, draw.mint), amount: shortfall }
}

/**
 * The static inspection first, then the chain's own verdict on the balances. A message the
 * inspection refuses is never simulated: there is nothing a simulation could say to redeem it.
 *
 * guard-core tops the hot wallet up only after this clears, so a short hot wallet is topped up here
 * too, in front of the payment inside the one simulated transaction. The inspection still sees the
 * payment alone, which is all that will be signed for it.
 *
 * The balances before are read a moment before the simulation runs, so a payment landing in
 * between makes this refuse a good transaction. That is the side to err on.
 */
export async function simulateMessage(
  connection: Connection,
  message: VersionedMessage,
  payment: Payment,
  topUp?: TopUp,
): Promise<SimulationOutcome> {
  const expected = expectedTransfer(payment)
  const simulation = describe(payment, topUp)

  const inspected = inspectTransfer(message, expected)
  if (inspected.length > 0) {
    return { simulation, rejectReasons: inspected }
  }

  const watched = [expected.source, expected.destination, ...(topUp ? [topUp.vault] : [])]
  const before = await connection.getMultipleAccountsInfo(watched)
  const { value } = await connection.simulateTransaction(simulated(message, topUp), {
    sigVerify: false,
    replaceRecentBlockhash: true,
    accounts: { encoding: 'base64', addresses: watched.map((key) => key.toBase58()) },
  })
  if (value.err || !value.accounts) {
    const why = failure(value.err, value.logs ?? [], topUp)
    return { simulation: { ...simulation, summary: why }, rejectReasons: ['SIM_FAILED'] }
  }

  const after = value.accounts.map(fromSimulation)
  try {
    const reasons = checkEffects(
      {
        source: tokenAccount(watched[0]!, before[0]),
        destination: tokenAccount(watched[1]!, before[1]),
      },
      {
        source: tokenAccount(watched[0]!, after[0]),
        destination: tokenAccount(watched[1]!, after[1]),
      },
      payment,
      topUp?.amount,
    )
    if (topUp) {
      const vaultBefore = tokenAccount(topUp.vault, before[2])
      const vaultAfter = tokenAccount(topUp.vault, after[2])
      const drawn =
        vaultBefore && vaultAfter && vaultAfter.amount === vaultBefore.amount - topUp.amount
      if (!drawn) {
        return { simulation, rejectReasons: ['SIM_UNEXPECTED_EFFECT'] }
      }
    }
    return { simulation, rejectReasons: reasons }
  } catch {
    // Not a token account of the classic program: whatever it is, it is not the payment agreed.
    return { simulation, rejectReasons: ['SIM_UNEXPECTED_EFFECT'] }
  }
}

/** The payment, with the draw in front of it when there is one. Inspection has refused lookup tables. */
function simulated(message: VersionedMessage, topUp?: TopUp): VersionedTransaction {
  if (!topUp) {
    return new VersionedTransaction(message)
  }
  const payment = TransactionMessage.decompile(message)
  return new VersionedTransaction(
    new TransactionMessage({
      ...payment,
      instructions: [...topUp.instructions, ...payment.instructions],
    }).compileToV0Message(),
  )
}

// Squads' Anchor error for a draw past the limit, as it appears in the program logs.
const EXCEEDED = /SpendingLimitExceeded/

function failure(err: unknown, logs: string[], topUp?: TopUp): string {
  const error = typeof err === 'string' ? err : JSON.stringify(err ?? 'no accounts returned')
  if (topUp && logs.some((line) => EXCEEDED.test(line))) {
    return `simulation failed: the top-up of ${formatUnits(topUp.amount, USDC_DECIMALS)} USDC from the vault exceeds the spending limit (${error})`
  }
  // The last program log usually names the failure; the rest is the runtime's trace.
  const last = logs.filter((line) => /failed|Error/.test(line)).at(-1)
  return `simulation failed: ${error}${last ? `: ${last}` : ''}`
}

function describe(payment: Payment, topUp?: TopUp): SimulationResult {
  const usd = (amount: bigint) => `${formatUnits(amount, payment.decimals)} USDC`
  const paying = `pays ${usd(payment.amount)} from ${payment.hotWallet.toBase58()} to ${payment.recipient.toBase58()}`
  return {
    summary: topUp ? `draws ${usd(topUp.amount)} from the vault, then ${paying}` : paying,
    balanceChanges: [{ token: payment.mint.toBase58(), delta: (-payment.amount).toString() }],
  }
}

function fromSimulation(
  account: SimulatedTransactionAccountInfo | null | undefined,
): AccountInfo<Buffer> | null {
  if (!account) {
    return null
  }
  const [data] = account.data
  return {
    data: Buffer.from(data ?? '', 'base64'),
    owner: new PublicKey(account.owner),
    lamports: account.lamports,
    executable: account.executable,
  }
}

function tokenAccount(
  address: PublicKey,
  info: AccountInfo<Buffer> | null | undefined,
): Account | null {
  return info ? unpackAccount(address, info, TOKEN_PROGRAM_ID) : null
}
