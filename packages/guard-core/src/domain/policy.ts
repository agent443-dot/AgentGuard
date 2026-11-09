import type { Amount, PayIntent, Policy, PolicyDecision, RejectCode } from '@agentguard/shared'
import { parseAmount } from './amount.js'

/** What a policy means for each field it leaves out. A policy that sets none behaves as before. */
export const POLICY_DEFAULTS = {
  mode: 'live',
  priceIncreaseMaxPct: 100,
  maxPaymentsPerMinute: 10,
  requireMandate: false,
} as const satisfies Required<
  Pick<Policy, 'mode' | 'priceIncreaseMaxPct' | 'maxPaymentsPerMinute' | 'requireMandate'>
>

export interface Evaluation {
  decision: PolicyDecision
  /** Every rule the intent broke, not just the first, so the audit log explains itself. */
  reasons: RejectCode[]
}

/**
 * Default deny: an intent is approved only when no rule objects. Pure, so the attack cases can be
 * enumerated in tests rather than argued about.
 */
export function evaluate(intent: PayIntent, policy: Policy, spentToday: Amount): Evaluation {
  const reasons: RejectCode[] = []

  if (policy.paused) {
    reasons.push('PAUSED')
  }
  if (!policy.chains.includes(intent.chain)) {
    reasons.push('CHAIN_NOT_ALLOWED')
  }
  if (!policy.tokens.includes(intent.token)) {
    reasons.push('TOKEN_NOT_ALLOWED')
  }

  if (intent.kind === 'transfer' && !policy.allowedRecipients.includes(intent.recipient)) {
    reasons.push('RECIPIENT_NOT_ALLOWED')
  }

  // An x402 recipient comes from the 402 response, so the domain allowlist is what vouches for it.
  if (
    intent.kind === 'x402' &&
    (!intent.domain || !policy.allowedDomains.includes(intent.domain))
  ) {
    reasons.push('DOMAIN_NOT_ALLOWED')
  }

  const amount = parseAmount(intent.amount)
  if (amount > parseAmount(policy.perTxMax)) {
    reasons.push('PER_TX_EXCEEDED')
  }
  if (parseAmount(spentToday) + amount > parseAmount(policy.dailyMax)) {
    reasons.push('DAILY_EXCEEDED')
  }

  if (reasons.length > 0) {
    return { decision: 'reject', reasons }
  }
  if (amount >= parseAmount(policy.approvalThreshold)) {
    return { decision: 'needs_approval', reasons: [] }
  }
  return { decision: 'approve', reasons: [] }
}
