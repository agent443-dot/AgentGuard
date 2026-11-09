import type { IntentStatus, PayIntentKind, RejectCode } from '@agentguard/shared'

const REASONS: Record<RejectCode, string> = {
  PAUSED: 'the owner has paused all payments for this agent',
  CHAIN_NOT_ALLOWED: 'the policy does not allow payments on this chain',
  TOKEN_NOT_ALLOWED: 'the policy does not allow paying with this token',
  RECIPIENT_NOT_ALLOWED: 'the recipient is not on the allowed list',
  DOMAIN_NOT_ALLOWED: 'the policy does not allow paying this website',
  PER_TX_EXCEEDED: 'the amount is above the per-payment limit',
  DAILY_EXCEEDED: 'the payment would go over the daily spending limit',
  SIM_FAILED: 'the transaction failed when it was simulated',
  SIM_UNEXPECTED_EFFECT: 'simulating the transaction showed effects other than the payment',
  OWNER_REJECTED: 'the owner rejected it',
  APPROVAL_TIMEOUT: 'the owner did not answer within the approval window',
  INVALID_402: "the website's payment request was malformed or unsafe",
  MANDATE_REQUIRED: 'the owner requires every payment to belong to a task budget',
  MANDATE_EXCEEDED:
    'the payment does not fit the task budget: too little is left, or it does not cover this website or recipient',
  MANDATE_EXPIRED: 'the task budget has expired, or the owner closed it',
  BREAKER_TRIPPED:
    'more payments in one minute than the owner allows, so AgentGuard paused this agent until the owner resumes it',
  APPROVAL_DETECTED: 'the transaction would grant a token approval',
  PERMIT_DETECTED: 'the payment asked for a token permit signature',
  DELEGATION_DETECTED: 'the transaction would delegate control of the wallet',
  DELEGATE_DETECTED: 'the transaction would set a delegate on a token account',
  AUTHORITY_CHANGE_DETECTED: 'the transaction would change an account authority',
  ACCOUNT_CLOSE_DETECTED: 'the transaction would close an account',
  UNKNOWN_PROGRAM_DETECTED: 'the transaction calls a program that is not on the allowlist',
  HIDDEN_ACCOUNTS_DETECTED: 'the transaction hides the accounts it touches behind lookup tables',
}

/** Codes where the right next step is not the generic "do not retry". */
const ADVICE: Partial<Record<RejectCode, string>> = {
  MANDATE_REQUIRED:
    'Open a task budget for this task with start_task, then repeat the payment with its mandateId.',
  MANDATE_EXCEEDED:
    'Stop paying for this task and tell the user. Open another task budget only if the user agrees to spend more.',
  MANDATE_EXPIRED:
    'Stop paying for this task and tell the user. Open a new task budget only if the user still wants it done.',
  BREAKER_TRIPPED:
    'Stop making payments and tell the user: every payment is refused until the owner resumes the agent.',
}

export function explainReject(code: string): string {
  return code in REASONS ? `${code}: ${REASONS[code as RejectCode]}` : `${code}: no description`
}

const NEXT_STEP: Record<IntentStatus, string> = {
  approved: 'The payment was approved and is being sent.',
  executed: 'The payment went through.',
  pending_approval:
    'The payment is waiting for the owner to approve it on Telegram. Tell the user it needs their ' +
    'approval, then call check_intent with this intent id every 15 to 30 seconds until it settles. ' +
    'Pending payments expire after 10 minutes. Do not repeat the request while it is pending.',
  rejected: 'The payment was rejected and no money moved. Do not retry the same payment.',
  failed: 'The payment was approved but sending it failed. No further action was taken.',
  expired: 'The owner did not approve the payment in time, so it expired. No money moved.',
  shadowed:
    'Shadow mode: nothing was paid and no money moved. This shows what the payment would have ' +
    'cost; the owner is trying the agent out before giving it money. Carry on as if the payment ' +
    'had been declined, and tell the user if the task needed it.',
}

/**
 * An x402 payment can only deliver its response to the agent's own request, so an approval is not
 * the end of it: the agent has to repeat the call to redeem it.
 */
const X402_NEXT_STEP: Partial<Record<IntentStatus, string>> = {
  pending_approval:
    'The payment is waiting for the owner to approve it on Telegram. Tell the user it needs their ' +
    'approval, then call check_intent with this intent id every 15 to 30 seconds. Do not repeat the ' +
    'request while it is pending. Once check_intent reports approved, call paid_fetch again with ' +
    'exactly the same url, method, headers and body to receive the response.',
  shadowed:
    'Shadow mode: nothing was paid and no money moved. The response below, if any, is the ' +
    "website's unpaid answer, not the paid content. The owner is trying the agent out before " +
    'giving it money; tell the user if the task needed the paid content.',
  approved:
    'The owner approved the payment. Call paid_fetch again with exactly the same url, method, ' +
    'headers and body to receive the response. The approval pays for that one request only and ' +
    'expires at the time check_intent shows if it is not used.',
}

export function explainStatus(
  status: IntentStatus,
  rejectReasons: readonly string[],
  kind: PayIntentKind,
): string {
  const lines = [(kind === 'x402' ? X402_NEXT_STEP[status] : undefined) ?? NEXT_STEP[status]]
  if (rejectReasons.length > 0) {
    lines.push('Reasons:', ...rejectReasons.map((code) => `- ${explainReject(code)}`))
    const advice = rejectReasons.flatMap((code) => ADVICE[code as RejectCode] ?? [])
    lines.push(...new Set(advice))
  }
  return lines.join('\n')
}
