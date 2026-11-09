import { formatUsd } from './money.js'
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

// Telegram refuses a message over 4096 characters; the page counter takes a few more.
const PAGE_LIMIT = 4000
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

/**
 * The report as Telegram messages. An agent's lines never split across two messages, so each page
 * reads on its own; more than one page is numbered.
 */
export function reportPages(agents: AgentReport[], from: Date, to: Date): string[] {
  const header = `<b>Report</b> ${utcTime(from)} to ${utcTime(to)}`
  if (agents.length === 0) {
    return [`${header}\nNo agent paid or was refused in this period.`]
  }
  const pages: string[] = []
  let page = header
  for (const block of agents.map(agentBlock)) {
    if (page.length + 1 + block.length > PAGE_LIMIT) {
      pages.push(page)
      page = block
    } else {
      page = `${page}\n${block}`
    }
  }
  pages.push(page)
  return pages.length === 1 ? pages : pages.map((text, i) => `(${i + 1}/${pages.length}) ${text}`)
}

/** The key of the weekly report due now, or undefined: one per scheduled hour, never twice. */
export function weeklyDue(
  now: Date,
  schedule: ReportSchedule,
  lastSent: string | undefined,
): string | undefined {
  const key = now.toISOString().slice(0, 10)
  const due = now.getUTCDay() === schedule.weekday && now.getUTCHours() === schedule.hourUtc
  return due && key !== lastSent ? key : undefined
}
