import { formatUsd } from './money.js'
import { pages } from './pages.js'
import { escapeHtml, utcTime } from './text.js'

export interface AgentReport {
  agentId: string
  spent: string
  payments: number
  /** Refusals by reject code. */
  refused: Record<string, number>
  domains: { domain: string; spent: string }[]
}

export interface ReportSchedule {
  /** 0 is Sunday, as Date.getUTCDay counts. */
  weekday: number
  hourUtc: number
}

export const REPORT_DAYS = 7

const TOP_DOMAINS = 5

function agentBlock({ agentId, spent, payments, refused, domains }: AgentReport): string {
  const lines = [
    `<code>${escapeHtml(agentId)}</code>: ${formatUsd(spent)} in ${payments} ` +
      `${payments === 1 ? 'payment' : 'payments'}`,
  ]
  const codes = Object.entries(refused)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
  if (codes.length > 0) {
    lines.push(`  Refused: ${codes.map(([code, n]) => `${escapeHtml(code)} ×${n}`).join(', ')}`)
  }
  const top = [...domains]
    .sort((a, b) => descending(BigInt(a.spent), BigInt(b.spent)))
    .slice(0, TOP_DOMAINS)
  if (top.length > 0) {
    lines.push(
      `  Top domains: ${top.map((d) => `${escapeHtml(d.domain)} ${formatUsd(d.spent)}`).join(', ')}`,
    )
  }
  return lines.join('\n')
}

function descending(a: bigint, b: bigint): number {
  return a < b ? 1 : a > b ? -1 : 0
}

/** The report as Telegram messages, an agent never split across two. */
export function reportPages(agents: AgentReport[], from: Date, to: Date): string[] {
  const header =
    `<b>Report</b> ${utcTime(from)} to ${utcTime(to)}\n` +
    "<i>Spend is each chain's dollar (USDC, or USDG on Robinhood Chain), added up.</i>"
  return agents.length === 0
    ? [`${header}\nNo agent paid or was refused in this period.`]
    : pages(header, agents.map(agentBlock))
}

/**
 * The key of the weekly report due now, or undefined. Due only in the first minute of the scheduled
 * hour, which the 15-second sweep reaches four times: the sent key stops a repeat within that
 * minute, and a bot restarted later in the hour, which has lost the key, does not send it again.
 */
export function weeklyDue(
  now: Date,
  schedule: ReportSchedule,
  lastSent: string | undefined,
): string | undefined {
  const key = now.toISOString().slice(0, 10)
  const due =
    now.getUTCDay() === schedule.weekday &&
    now.getUTCHours() === schedule.hourUtc &&
    now.getUTCMinutes() === 0
  return due && key !== lastSent ? key : undefined
}
