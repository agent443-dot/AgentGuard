import type { IntentStatus, RejectCode } from '@agentguard/shared'

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
  APPROVAL_DETECTED: 'the transaction would grant a token approval',
  PERMIT_DETECTED: 'the payment asked for a token permit signature',
  DELEGATION_DETECTED: 'the transaction would delegate control of the wallet',
  DELEGATE_DETECTED: 'the transaction would set a delegate on a token account',
  AUTHORITY_CHANGE_DETECTED: 'the transaction would change an account authority',
  ACCOUNT_CLOSE_DETECTED: 'the transaction would close an account',
  UNKNOWN_PROGRAM_DETECTED: 'the transaction calls a program that is not on the allowlist',
  HIDDEN_ACCOUNTS_DETECTED: 'the transaction hides the accounts it touches behind lookup tables',
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
}

export function explainStatus(status: IntentStatus, rejectReasons: readonly string[]): string {
  const lines = [NEXT_STEP[status]]
  if (rejectReasons.length > 0) {
    lines.push('Reasons:', ...rejectReasons.map((code) => `- ${explainReject(code)}`))
  }
  return lines.join('\n')
}
