import type { Amount } from '@agentguard/shared'

const ATOMIC = /^(0|[1-9]\d*)$/

/**
 * Amounts cross boundaries as decimal strings of atomic units and are bigint everywhere inside.
 * Anything else is a bug upstream: the zod schemas reject malformed input before it reaches here.
 */
export function parseAmount(value: Amount): bigint {
  if (!ATOMIC.test(value)) {
    throw new Error(`invalid_amount: ${value}`)
  }
  return BigInt(value)
}

export function toAmount(value: bigint): Amount {
  if (value < 0n) {
    throw new Error(`negative_amount: ${value}`)
  }
  return value.toString()
}
