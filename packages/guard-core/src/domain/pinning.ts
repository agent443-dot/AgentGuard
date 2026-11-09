import type { Address, Amount, ApprovalFlag, ChainId, PayIntent } from '@agentguard/shared'
import { parseAmount } from './amount.js'

/** The terms of the last x402 payment an agent made to a domain. */
export interface Pin {
  chain: ChainId
  token: Address
  recipient: Address
  amount: Amount
}

/**
 * Why a payment to a known domain should go to the owner first. A domain with no pin yet raises
 * nothing: the first payment is judged by the policy alone, and it sets the pin.
 */
export function pinFlags(
  pin: Pin | undefined,
  intent: PayIntent,
  maxIncreasePct: number,
): ApprovalFlag[] {
  if (pin === undefined) {
    return []
  }
  const flags: ApprovalFlag[] = []
  if (
    pin.recipient !== intent.recipient ||
    pin.chain !== intent.chain ||
    pin.token !== intent.token
  ) {
    flags.push('RECIPIENT_CHANGED')
  }
  // In integers: amount / pinned > 1 + pct / 100, multiplied through by 100 * pinned.
  if (
    parseAmount(intent.amount) * 100n >
    parseAmount(pin.amount) * (100n + BigInt(maxIncreasePct))
  ) {
    flags.push('PRICE_JUMP')
  }
  return flags
}
