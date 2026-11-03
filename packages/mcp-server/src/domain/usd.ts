import { USDC_DECIMALS } from '@agentguard/shared'

/**
 * Plain digits, optional fraction, nothing else. No sign, exponent, whitespace, "NaN" or "Infinity":
 * each of those is a way for a number to mean something other than what the model wrote. More than
 * six fraction digits would have to be rounded to fit USDC, so it is refused rather than rounded.
 */
const USD = new RegExp(`^(0|[1-9]\\d{0,11})(\\.\\d{1,${USDC_DECIMALS}})?$`)

const SCALE = 10n ** BigInt(USDC_DECIMALS)

export type UsdParse = { ok: true; atomic: bigint } | { ok: false; error: string }

export function parseUsd(value: string): UsdParse {
  const match = USD.exec(value)
  if (!match) {
    return {
      ok: false,
      error:
        `"${value.slice(0, 40)}" is not a valid USD amount. Write a plain decimal string with at most ` +
        `${USDC_DECIMALS} decimal places and no sign or exponent, for example "0.25" or "12".`,
    }
  }
  const [, whole = '0', fraction = ''] = match
  const cents = fraction.slice(1).padEnd(USDC_DECIMALS, '0')
  return { ok: true, atomic: BigInt(whole) * SCALE + BigInt(cents) }
}

/** Renders atomic USDC as dollars, trimming trailing zeros but keeping two places: "$1.50", "$0.000001". */
export function formatUsd(atomic: bigint): string {
  const sign = atomic < 0n ? '-' : ''
  const abs = atomic < 0n ? -atomic : atomic
  const whole = abs / SCALE
  const fraction = (abs % SCALE).toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  return `${sign}$${whole}.${fraction.padEnd(2, '0')}`
}

/** Guard sends amounts as atomic decimal strings; anything else is shown as-is rather than guessed at. */
export function formatAmount(amount: string): string {
  return /^-?(0|[1-9]\d*)$/.test(amount) ? formatUsd(BigInt(amount)) : `${amount} (atomic units)`
}
