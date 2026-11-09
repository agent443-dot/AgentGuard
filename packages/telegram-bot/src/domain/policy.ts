import type { AgentSummary, DoctorCheck, Policy } from '@agentguard/shared'
import { USDC_DECIMALS } from '@agentguard/shared'
import { formatUsd } from './money.js'
import { chainName, escapeHtml } from './text.js'

/** The three amounts an owner edits from Telegram. A raise of any of them asks for a confirm. */
export const LIMITS = ['perTxMax', 'dailyMax', 'approvalThreshold'] as const
export type Limit = (typeof LIMITS)[number]

export const LIMIT_NAMES: Record<Limit, string> = {
  perTxMax: 'per payment max',
  dailyMax: 'daily max',
  approvalThreshold: 'approval threshold',
}

const DOLLARS = /^\$?(\d{1,12})(?:\.(\d{1,6}))?$/

/** "12.5" or "$12.50" to atomic units, in bigint; undefined for anything else, a negative included. */
export function parseDollars(text: string): string | undefined {
  const match = DOLLARS.exec(text.trim())
  if (match === null) {
    return undefined
  }
  const [, whole = '0', fraction = ''] = match
  const unit = 10n ** BigInt(USDC_DECIMALS)
  return (BigInt(whole) * unit + BigInt(fraction.padEnd(USDC_DECIMALS, '0'))).toString()
}

export const PRESETS = {
  Careful: { perTxMax: '1000000', dailyMax: '5000000', approvalThreshold: '500000' },
  Standard: { perTxMax: '5000000', dailyMax: '20000000', approvalThreshold: '1000000' },
} as const satisfies Record<string, Record<Limit, string>>

export type Preset = keyof typeof PRESETS

/** The limits that went up from before to after: those are the ones the owner confirms. */
export function raises(before: Policy, after: Policy): Limit[] {
  return LIMITS.filter((limit) => BigInt(after[limit]) > BigInt(before[limit]))
}

/** Lowercase DNS labels only: an allowlist entry that is not a hostname would never match a request. */
export function hostname(text: string): string | undefined {
  const host = text.trim().toLowerCase()
  const label = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/
  const labels = host.split('.')
  return host.length <= 253 && labels.length >= 2 && labels.every((part) => label.test(part))
    ? host
    : undefined
}

export function policyText(policy: Policy): string {
  const domains = policy.allowedDomains.map((domain) => `<code>${escapeHtml(domain)}</code>`)
  return [
    `<b>Policy</b> for <code>${escapeHtml(policy.agentId)}</code>`,
    `Mode: ${policy.mode ?? 'live'}${policy.paused ? ', <b>paused</b>' : ''}`,
    `Per payment: up to ${formatUsd(policy.perTxMax)}`,
    `Daily: up to ${formatUsd(policy.dailyMax)}`,
    `Owner approval: at or above ${formatUsd(policy.approvalThreshold)}`,
    `Chains: ${policy.chains.map(chainName).join(', ') || 'none'}`,
    `Domains: ${domains.join(', ') || 'none (every x402 payment is refused)'}`,
    `Direct transfer recipients: ${policy.allowedRecipients.length}`,
  ].join('\n')
}

export function raiseText(agentId: string, before: Policy, after: Policy, up: Limit[]): string {
  const lines = up.map(
    (limit) =>
      `• ${LIMIT_NAMES[limit]}: ${formatUsd(before[limit])} → <b>${formatUsd(after[limit])}</b>`,
  )
  return [`<b>Raise the limits</b> of <code>${escapeHtml(agentId)}</code>?`, ...lines].join('\n')
}

export function agentsText(agents: AgentSummary[]): string {
  if (agents.length === 0) {
    return 'No agents yet. Create one with /agent new &lt;id&gt;.'
  }
  return [
    `<b>Agents</b> (${agents.length})`,
    ...agents.map(
      ({ agentId, mode, paused }) =>
        `• <code>${escapeHtml(agentId)}</code>: ${mode}${paused ? ', paused' : ''}`,
    ),
  ].join('\n')
}

const MARKS: Record<DoctorCheck['status'], string> = { ok: '✅', warn: '⚠️', fail: '❌' }

/** One block per check, with the fix under each warning or failure. */
export function doctorBlocks(checks: DoctorCheck[]): string[] {
  return checks.map(({ status, message, fix }) =>
    status !== 'ok' && fix !== undefined
      ? `${MARKS[status]} ${escapeHtml(message)}\n    Fix: ${escapeHtml(fix)}`
      : `${MARKS[status]} ${escapeHtml(message)}`,
  )
}
