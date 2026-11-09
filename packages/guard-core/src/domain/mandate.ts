import type { Amount, Mandate, PayIntent, Policy, RejectCode } from '@agentguard/shared'
import { parseAmount } from './amount.js'

/**
 * What stops a payment against its mandate. A payment that names no mandate passes, unless the
 * policy requires one. A mandate id that is unknown or belongs to another agent counts as none.
 */
export function mandateReasons(
  intent: PayIntent,
  mandate: Mandate | undefined,
  requireMandate: boolean,
  now: Date,
): RejectCode[] {
  if (intent.mandateId === undefined) {
    return requireMandate ? ['MANDATE_REQUIRED'] : []
  }
  if (mandate === undefined || mandate.agentId !== intent.agentId) {
    return ['MANDATE_REQUIRED']
  }
  // A budget that is used up is exceeded, not expired: the task may still be running.
  if (mandate.status === 'exhausted') {
    return ['MANDATE_EXCEEDED']
  }
  if (mandate.status !== 'active' || new Date(mandate.expiresAt).getTime() <= now.getTime()) {
    return ['MANDATE_EXPIRED']
  }
  const reasons: RejectCode[] = []
  if (parseAmount(mandate.spent) + parseAmount(intent.amount) > parseAmount(mandate.budget)) {
    reasons.push('MANDATE_EXCEEDED')
  }
  if (intent.kind === 'x402' && !mandate.domains.includes(intent.domain ?? '')) {
    reasons.push('DOMAIN_NOT_ALLOWED')
  }
  if (intent.kind === 'transfer' && !mandate.recipients.includes(intent.recipient)) {
    reasons.push('RECIPIENT_NOT_ALLOWED')
  }
  return reasons
}

/**
 * A mandate narrows the policy, never widens it: every domain and recipient must already be
 * allowed, and its budget cannot exceed what the agent may spend in a day.
 */
export function outsidePolicy(
  terms: { budget: Amount; domains: string[]; recipients: string[] },
  policy: Policy,
): RejectCode[] {
  const reasons: RejectCode[] = []
  if (policy.paused) {
    reasons.push('PAUSED')
  }
  if (!terms.domains.every((domain) => policy.allowedDomains.includes(domain))) {
    reasons.push('DOMAIN_NOT_ALLOWED')
  }
  if (!terms.recipients.every((recipient) => policy.allowedRecipients.includes(recipient))) {
    reasons.push('RECIPIENT_NOT_ALLOWED')
  }
  if (parseAmount(terms.budget) > parseAmount(policy.dailyMax)) {
    reasons.push('DAILY_EXCEEDED')
  }
  return reasons
}
