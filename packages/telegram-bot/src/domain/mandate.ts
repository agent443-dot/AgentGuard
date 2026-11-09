import type { MandateRequest } from '../http/schemas.js'
import { formatUsd } from './money.js'
import { escapeHtml, type Outcome, outcomeLine, utcTime } from './text.js'

// Enough to judge the request while the message stays far under Telegram's 4096 characters.
const SHOWN = 10

/** In full: a shortened address is what address poisoning imitates. */
function list(items: string[]): string {
  if (items.length === 0) {
    return 'none'
  }
  const shown = items.slice(0, SHOWN).map((item) => `<code>${escapeHtml(item)}</code>`)
  const more = items.length > SHOWN ? `, and ${items.length - SHOWN} more` : ''
  return `${shown.join(', ')}${more}`
}

/**
 * Everything in a mandate came from the agent but the budget guard-core checked. The duration is
 * ttlSeconds, counted from approval: a pending mandate's expiresAt is only the approval deadline.
 */
function details({ mandate, approveBefore, ttlSeconds }: MandateRequest): string[] {
  const span = ttlSeconds === undefined ? '' : ` for ${Math.round(ttlSeconds / 60)} min`
  return [
    `Agent <code>${escapeHtml(mandate.agentId)}</code> asks for a task budget of ` +
      `<b>${formatUsd(mandate.budget)}</b>${span}.`,
    `Domains: ${list(mandate.domains)}`,
    ...(mandate.recipients.length === 0 ? [] : [`Recipients: ${list(mandate.recipients)}`]),
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
