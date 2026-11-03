import type { Amount, Policy, RejectCode } from '@agentguard/shared'
import type { PaymentRequirements } from '@x402/core/types'
import { parseAmount } from './amount.js'

/** The only scheme we sign. Anything else is a payment shape we have not reasoned about. */
const SUPPORTED_SCHEME = 'exact'

export interface AcceptChoice {
  chosen?: PaymentRequirements
  /** Empty when `chosen` is set. Otherwise every distinct objection across the offered options. */
  reasons: RejectCode[]
}

/**
 * Picks the first offer we are willing to pay, or explains why none qualified.
 *
 * The 402 response is attacker-controlled: a server can ask for the wrong asset, the wrong network,
 * or the entire balance. Decoding it is the SDK's job; deciding whether it is acceptable is ours.
 */
export function chooseAccept(
  accepts: readonly PaymentRequirements[],
  policy: Policy,
  maxAmount?: Amount,
): AcceptChoice {
  if (accepts.length === 0) {
    return { reasons: ['INVALID_402'] }
  }

  const seen: RejectCode[] = []
  for (const candidate of accepts) {
    const reasons = check(candidate, policy, maxAmount)
    if (reasons.length === 0) {
      return { chosen: candidate, reasons: [] }
    }
    for (const reason of reasons) {
      if (!seen.includes(reason)) {
        seen.push(reason)
      }
    }
  }
  return { reasons: seen }
}

function check(
  requirements: PaymentRequirements,
  policy: Policy,
  maxAmount: Amount | undefined,
): RejectCode[] {
  const reasons: RejectCode[] = []

  if (requirements.scheme !== SUPPORTED_SCHEME) {
    reasons.push('INVALID_402')
  }
  if (typeof requirements.payTo !== 'string' || requirements.payTo.length === 0) {
    reasons.push('INVALID_402')
  }
  if (!policy.chains.includes(requirements.network)) {
    reasons.push('CHAIN_NOT_ALLOWED')
  }
  if (!policy.tokens.includes(requirements.asset)) {
    reasons.push('TOKEN_NOT_ALLOWED')
  }

  let amount: bigint
  try {
    amount = parseAmount(requirements.amount)
  } catch {
    return [...reasons, 'INVALID_402']
  }

  // The effective ceiling is whichever is tighter: the owner's policy or the agent's own cap.
  let ceiling = parseAmount(policy.perTxMax)
  if (maxAmount !== undefined) {
    const declared = parseAmount(maxAmount)
    if (declared < ceiling) {
      ceiling = declared
    }
  }
  if (amount > ceiling) {
    reasons.push('PER_TX_EXCEEDED')
  }

  return reasons
}

/**
 * A server may answer the retry with different terms than it quoted. Anything that moves the money
 * or the recipient invalidates the decision the owner and the policy engine already made.
 */
export function requirementsChanged(
  quoted: PaymentRequirements,
  retried: PaymentRequirements,
): boolean {
  return (
    quoted.scheme !== retried.scheme ||
    quoted.network !== retried.network ||
    quoted.asset !== retried.asset ||
    quoted.amount !== retried.amount ||
    quoted.payTo !== retried.payTo
  )
}
