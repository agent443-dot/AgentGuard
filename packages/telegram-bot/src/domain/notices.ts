import type { ApprovalRequest } from '@agentguard/shared'
import { amountText, chainName, escapeHtml, utcTime } from './text.js'

export function breakerText(agentId: string, detail: string): string {
  const id = `<code>${escapeHtml(agentId)}</code>`
  return [
    `<b>Circuit breaker tripped</b> for ${id}: paused. /resume ${id} when you have looked.`,
    ...(detail === '' ? [] : [`guard-core says: <i>${escapeHtml(detail)}</i>`]),
  ].join('\n')
}

// Telegram refuses a message over 4096 characters, and /status adds the chains after this.
const PENDING_LIMIT = 2000

export function statusText(guardUp: boolean, pending: ApprovalRequest[]): string {
  const lines: string[] = []
  let length = 0
  for (const { intent, approveBefore } of pending) {
    const line =
      `• <code>${escapeHtml(intent.agentId)}</code> ${amountText(intent)} on ` +
      `${chainName(intent.chain)}, expires ${utcTime(approveBefore)}`
    if (length + line.length > PENDING_LIMIT) {
      lines.push(`…and ${pending.length - lines.length} more. Each one is in the chat above.`)
      break
    }
    lines.push(line)
    length += line.length + 1
  }
  return [
    `guard-core: ${guardUp ? 'reachable' : '<b>unreachable</b>'}`,
    `Pending approvals: ${pending.length}`,
    ...lines,
  ].join('\n')
}
