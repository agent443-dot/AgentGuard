/**
 * Constants from /SPEC.md. Owner: integrator (Session 5).
 */
import type { RejectCode } from './types.js'

export const CHAIN_IDS = {
  baseSepolia: 84532,
  base: 8453,
} as const

export type SupportedChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS]

/** USDC is the only token in v0.1. */
export const USDC_DECIMALS = 6

/** guard-core HTTP API port. */
export const GUARD_PORT = 8787

/** Pending intents expire after 10 minutes -> status "expired", reason APPROVAL_TIMEOUT. */
export const APPROVAL_TTL_MS = 10 * 60 * 1000

/** Safe Allowance Module reset period: 1440 minutes = 24h. */
export const ALLOWANCE_RESET_TIME_MIN = 1440

export const REJECT_CODES = [
  'PAUSED',
  'CHAIN_NOT_ALLOWED',
  'TOKEN_NOT_ALLOWED',
  'RECIPIENT_NOT_ALLOWED',
  'DOMAIN_NOT_ALLOWED',
  'PER_TX_EXCEEDED',
  'DAILY_EXCEEDED',
  'SIM_FAILED',
  'SIM_UNEXPECTED_EFFECT',
  'APPROVAL_DETECTED',
  'PERMIT_DETECTED',
  'DELEGATION_DETECTED',
  'OWNER_REJECTED',
  'APPROVAL_TIMEOUT',
  'INVALID_402',
] as const satisfies readonly RejectCode[]
