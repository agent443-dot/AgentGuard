import { formatUsd } from './amount.js'
import { NETWORKS, usdToken } from './networks.js'
import type { Setup } from './plan.js'

/** What to send where. The vault holds the dollars; the hot wallet only the gas for its draws. */
export function fundingLines(setup: Setup): string[] {
  return setup.answers.networks.flatMap((network) => {
    const { label, native, gas, usd, family } = NETWORKS[network]
    const cap = formatUsd(BigInt(setup.answers.caps[network] ?? '0'))
    const vault =
      family === 'solana'
        ? `the vault address the page printed (not the multisig ${setup.vaults[network] ?? ''})`
        : `the Safe ${setup.vaults[network] ?? ''} (token ${usdToken(network)}: others share the name)`
    return [
      `${label}:`,
      `  - send about ${gas} ${native} to the hot wallet ${setup.hot[network] ?? ''}, for fees`,
      `  - send ${usd} to ${vault}`,
      `    Hold only what your agents need for the next few days; the most a day can cost is the`,
      `    ${cap} ${usd} cap plus what the hot wallet holds.`,
    ]
  })
}
