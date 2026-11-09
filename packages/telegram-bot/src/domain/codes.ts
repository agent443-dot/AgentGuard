import type { EvmRejectCode, RejectCode, SvmRejectCode } from '@agentguard/shared'
import { SHARED_REJECT_CODES } from '@agentguard/shared'

/** A rejection with one of these means something tried to take standing authority over funds. */
export const ATTACK_CODES = [
  'APPROVAL_DETECTED',
  'PERMIT_DETECTED',
  'DELEGATION_DETECTED',
  'DELEGATE_DETECTED',
  'AUTHORITY_CHANGE_DETECTED',
  'ACCOUNT_CLOSE_DETECTED',
  'UNKNOWN_PROGRAM_DETECTED',
  'HIDDEN_ACCOUNTS_DETECTED',
] as const satisfies readonly (EvmRejectCode | SvmRejectCode)[]

export type AttackCode = (typeof ATTACK_CODES)[number]

export const REJECT_CODES = [...SHARED_REJECT_CODES, ...ATTACK_CODES] as const

/** What the owner reads; the code alone means nothing to someone who did not write the checks. */
export const ATTACK_DESCRIPTIONS: Record<AttackCode, string> = {
  APPROVAL_DETECTED:
    'a token approval to a third party (approve, increaseAllowance, setApprovalForAll)',
  PERMIT_DETECTED: 'a Permit or Permit2 signature that would let someone else move funds',
  DELEGATION_DETECTED: 'an EIP-7702 authorization handing the wallet to other code',
  DELEGATE_DETECTED: 'an SPL Approve naming a delegate on a token account',
  AUTHORITY_CHANGE_DETECTED: 'a SetAuthority changing who controls an account',
  ACCOUNT_CLOSE_DETECTED: 'a CloseAccount on a token account',
  UNKNOWN_PROGRAM_DETECTED: 'a call into a program that is not on the allowlist',
  HIDDEN_ACCOUNTS_DETECTED: 'address lookup tables hiding which accounts the transaction touches',
}

/** Why guard-core sends a payment to the owner even below the threshold. */
export const APPROVAL_FLAGS = ['RECIPIENT_CHANGED', 'PRICE_JUMP'] as const
export type ApprovalFlag = (typeof APPROVAL_FLAGS)[number]

export const FLAG_DESCRIPTIONS: Record<ApprovalFlag, string> = {
  RECIPIENT_CHANGED: 'This API asks to pay a different address than last time.',
  PRICE_JUMP: 'Price jump: this API asks for much more than its last payment.',
}

export function attackCodesIn(reasons: readonly RejectCode[]): AttackCode[] {
  return reasons.filter((code): code is AttackCode => code in ATTACK_DESCRIPTIONS)
}
