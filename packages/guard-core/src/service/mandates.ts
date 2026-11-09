import type { Amount, Mandate, RejectCode } from '@agentguard/shared'
import { randomUUID } from 'node:crypto'
import { insertMandate } from '../db/mandates.js'
import * as repo from '../db/repo.js'
import { parseAmount } from '../domain/amount.js'
import { outsidePolicy } from '../domain/mandate.js'
import { expiresAt } from './approvals.js'
import type { PaymentDeps } from './payments.js'

export interface MandateTerms {
  agentId: string
  budget: Amount
  domains: string[]
  recipients: string[]
  ttlSeconds: number
  reason: string
}

export type Opened = { mandate: Mandate } | { refused: RejectCode[] } | { notFound: true }

/**
 * Opens a task budget. The owner's own starts at once. An agent's starts at once below the
 * approval threshold, and otherwise waits for the owner, as a payment of that size would.
 */
export async function openMandate(
  deps: Pick<PaymentDeps, 'db' | 'bot' | 'now' | 'log'>,
  terms: MandateTerms,
  byOwner: boolean,
): Promise<Opened> {
  const { db, now } = deps
  const policy = repo.getPolicy(db, terms.agentId)
  if (policy === undefined) {
    return { notFound: true }
  }
  const refused = outsidePolicy(terms, policy)
  if (refused.length > 0) {
    repo.audit(
      db,
      { event: 'mandate_refused', agentId: terms.agentId, reasons: refused, detail: { byOwner } },
      now(),
    )
    return { refused }
  }

  const at = now()
  const ask = !byOwner && parseAmount(terms.budget) >= parseAmount(policy.approvalThreshold)
  const mandate: Mandate = {
    id: randomUUID(),
    agentId: terms.agentId,
    budget: terms.budget,
    spent: '0',
    domains: terms.domains,
    recipients: terms.recipients,
    reason: terms.reason,
    status: ask ? 'pending_approval' : 'active',
    createdAt: at.toISOString(),
    expiresAt: ask ? expiresAt(at) : new Date(at.getTime() + terms.ttlSeconds * 1000).toISOString(),
  }
  insertMandate(db, mandate, terms.ttlSeconds)
  repo.audit(
    db,
    {
      event: 'mandate_opened',
      agentId: terms.agentId,
      detail: { mandateId: mandate.id, status: mandate.status, budget: mandate.budget, byOwner },
    },
    at,
  )
  if (ask) {
    try {
      await deps.bot.requestApproval({
        mandate,
        // Opening a budget moves nothing; the payments made under it are each simulated.
        simulation: { summary: 'opens a task budget; no funds move now', balanceChanges: [] },
        approveBefore: mandate.expiresAt,
      })
    } catch (error) {
      // Saved as pending first, so the sweep closes it if the bot never hears.
      deps.log.warn({ err: error, mandateId: mandate.id }, 'mandate approval webhook failed')
    }
  }
  return { mandate }
}
