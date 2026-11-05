import type { RejectCode } from '@agentguard/shared'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  type Account,
} from '@solana/spl-token'
import type { PublicKey, TransactionInstruction } from '@solana/web3.js'
import type { ExpectedTransfer } from './inspect.js'

export interface Payment {
  /** Pays the network fee: the hot wallet for our own transfers, the facilitator under x402. */
  feePayer: PublicKey
  hotWallet: PublicKey
  /** The wallet being paid, not its token account. */
  recipient: PublicKey
  mint: PublicKey
  amount: bigint
  decimals: number
}

// A recipient may be a PDA, a Squads vault for instance. Who may be paid at all is the policy's call,
// not the curve's.
const ALLOW_OFF_CURVE = true

export function expectedTransfer(payment: Payment): ExpectedTransfer {
  return {
    feePayer: payment.feePayer,
    authority: payment.hotWallet,
    source: getAssociatedTokenAddressSync(payment.mint, payment.hotWallet),
    destination: getAssociatedTokenAddressSync(payment.mint, payment.recipient, ALLOW_OFF_CURVE),
    mint: payment.mint,
    amount: payment.amount,
    decimals: payment.decimals,
  }
}

/**
 * A recipient that never held the token has no account for it yet. The create is idempotent, so a
 * recipient whose account appears before this lands is still paid.
 */
export function transferInstructions(
  payment: Payment,
  createDestination: boolean,
): TransactionInstruction[] {
  const { source, destination } = expectedTransfer(payment)
  const create = createAssociatedTokenAccountIdempotentInstruction(
    payment.feePayer,
    destination,
    payment.recipient,
    payment.mint,
  )
  return [
    ...(createDestination ? [create] : []),
    createTransferCheckedInstruction(
      source,
      payment.mint,
      destination,
      payment.hotWallet,
      payment.amount,
      payment.decimals,
    ),
  ]
}

export interface TokenAccounts {
  source: Account | null
  destination: Account | null
}

/**
 * Compares the two token accounts before and after the simulated transaction. The hot wallet's must
 * move by exactly the top-up less the amount and still be the hot wallet's alone; the recipient's
 * must rise by exactly the amount. Only a top-up may create the hot wallet's account.
 */
export function checkEffects(
  before: TokenAccounts,
  after: TokenAccounts,
  payment: Payment,
  topUp = 0n,
): RejectCode[] {
  const { source, destination } = after
  if ((!before.source && topUp === 0n) || !source || !destination) {
    return ['SIM_UNEXPECTED_EFFECT']
  }
  const sourceIntact =
    source.mint.equals(payment.mint) &&
    source.owner.equals(payment.hotWallet) &&
    source.delegate === null &&
    source.closeAuthority === null &&
    source.amount === (before.source?.amount ?? 0n) + topUp - payment.amount
  const destinationPaid =
    destination.mint.equals(payment.mint) &&
    destination.owner.equals(payment.recipient) &&
    destination.amount === (before.destination?.amount ?? 0n) + payment.amount
  return sourceIntact && destinationPaid ? [] : ['SIM_UNEXPECTED_EFFECT']
}

/** Atomic units to a decimal string, in bigint so no amount is ever rounded for display. */
export function formatUnits(amount: bigint, decimals: number): string {
  const scale = 10n ** BigInt(decimals)
  const whole = amount / scale
  const fraction = (amount % scale).toString().padStart(decimals, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}
