import { USDC_DECIMALS } from '@agentguard/shared'

const ATOMIC = /^(0|[1-9]\d*)$/
const UNIT = 10n ** BigInt(USDC_DECIMALS)

/** Dollar-token atomic units (USDC and USDG both have 6 decimals) to dollars: always cents, more digits only when they are not zero. */
export function formatUsd(amount: string): string {
  if (!ATOMIC.test(amount)) {
    throw new Error(`not an atomic amount: ${amount}`)
  }
  const value = BigInt(amount)
  const whole = (value / UNIT).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = (value % UNIT).toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  return `$${whole}.${fraction.padEnd(2, '0')}`
}
