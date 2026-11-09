import type { MandateRequest } from '../http/schemas.js'
import { formatUsd } from './money.js'
import { escapeHtml, type Outcome, outcomeLine, shortAddress, utcTime } from './text.js'

function minutes(createdAt: string, expiresAt: string): number {
  return Math.round((Date.parse(expiresAt) - Date.parse(createdAt)) / 60_000)
}

const list = (items: string[], shown: (item: string) => string) =>
  items.length === 0
    ? 'none'
    : items.map((item) => `<code>${escapeHtml(shown(item))}</code>`).join(', ')

/** Everything in a mandate came from the agent but the budget and window guard-core checked. */
function details({ mandate, approveBefore }: MandateRequest): string[] {
  const span = minutes(mandate.createdAt, mandate.expiresAt)
  return [
    `Agent <code>${escapeHtml(mandate.agentId)}</code> asks for a task budget of ` +
      `<b>${formatUsd(mandate.budget)}</b> for ${span} min.`,
    `Domains: ${list(mandate.domains, (domain) => domain)}`,
    ...(mandate.recipients.length === 0
      ? []
      : [`Recipients: ${list(mandate.recipients, shortAddress)}`]),
    `Expires: ${utcTime(approveBefore)}`,
    '',
    `agent says: <i>${escapeHtml(mandate.reason) || '(nothing)'}</i>`,
  ]
}

export function mandateText(request: MandateRequest): string {
  return ['<b>Task budget requested</b>', ...details(request)].join('\n')
}

function settledLine(outcome: Outcome): string {
  switch (outcome.kind) {
    case 'approved':
    case 'rejected':
      return outcomeLine(outcome)
    case 'expired':
      return '<b>Expired</b>: not answered in time. No task budget was opened.'
    case 'already_decided':
      return '<b>Already decided</b>: this request was settled before your answer arrived.'
    case 'not_found':
      return '<b>Unknown request</b>: guard-core has no record of it. No task budget was opened.'
  }
}

export function mandateSettledText(request: MandateRequest, outcome: Outcome): string {
  return [settledLine(outcome), ...details(request)].join('\n')
}
