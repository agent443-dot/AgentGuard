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

/**
 * A dollar amount in base units of a 6-decimal token, for people: at least two decimals, and no
 * trailing zeros beyond them ("3.00", "0.123456").
 */
export function formatDollars(amount: Amount): string {
  const units = parseAmount(amount)
  const whole = units / 1_000_000n
  const fraction = (units % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '')
  return `${whole}.${fraction.padEnd(2, '0')}`
}
