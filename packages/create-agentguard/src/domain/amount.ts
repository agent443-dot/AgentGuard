import { USDC_DECIMALS } from '@agentguard/shared'
import { WizardError } from './errors.js'

const UNIT = 10n ** BigInt(USDC_DECIMALS)
const dollars = /^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/

/** "0.5" -> 500000n. Each chain's dollar has 6 decimals; anything finer is refused, not rounded. */
export function toBaseUnits(input: string): bigint {
  const match = dollars.exec(input.trim())
  if (match === null) {
    throw new WizardError('INVALID_INPUT', `"${input}" is not an amount in dollars, like 20 or 0.5`)
  }
  const [, whole = '0', fraction = ''] = match
  return BigInt(whole) * UNIT + BigInt(fraction.padEnd(USDC_DECIMALS, '0'))
}

export function formatUsd(units: bigint): string {
  const fraction = (units % UNIT).toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  const whole = (units / UNIT).toString()
  return fraction === '' ? whole : `${whole}.${fraction}`
}
