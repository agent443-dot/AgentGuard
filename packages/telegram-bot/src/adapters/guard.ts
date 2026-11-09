import type { BudgetView, KillResponse, PayIntent } from '@agentguard/shared'
import type { ChainStatus } from '../domain/chains.js'
import type { AgentReport } from '../domain/report.js'
import { z } from 'zod'
import { mandate, payIntent } from '../http/schemas.js'

export type Decision = 'approve' | 'reject'

type Refusal = { ok: false; reason: 'not_found' | 'already_decided' | 'expired' }

export type DecisionResult = { ok: true; intent: PayIntent } | Refusal

/** The bot only needs to know a decision went through; the mandate itself is not shown again. */
export type Settled = { ok: true } | Refusal

export interface GuardClient {
  decide(intentId: string, decision: Decision, telegramUserId: number): Promise<DecisionResult>
  decideMandate(mandateId: string, decision: Decision, telegramUserId: number): Promise<Settled>
  setPaused(agentId: string, paused: boolean): Promise<'ok' | 'not_found'>
  kill(): Promise<KillResponse>
  budget(agentId: string): Promise<Budget | undefined>
  /** Undefined while guard-core has no chains route (CR-006). */
  chains(): Promise<ChainStatus[] | undefined>
  /** Undefined while guard-core has no report route. */
  report(from: Date, to: Date): Promise<AgentReport[] | undefined>
  healthy(): Promise<boolean>
}

export class GuardError extends Error {
  constructor(readonly status: number) {
    super(`guard_core_error: ${status}`)
  }
}

export interface GuardClientOptions {
  url: string
  botToken: string
  adminToken: string
  fetch?: typeof fetch
}

const atomic = z.string().regex(/^(0|[1-9]\d*)$/)

const conflict = z.object({ error: z.enum(['already_decided', 'expired']) })

const notFound = z.object({ error: z.literal('not_found') })

const killResult = z.object({
  pausedAgents: z.number().int().nonnegative(),
  ownerTransactions: z.array(
    z.object({ chain: z.string().min(1), description: z.string(), payload: z.unknown() }),
  ),
})

const chainList = z.object({
  chains: z
    .array(
      z.object({
        chain: z.string().min(1).max(64),
        // CR-008. A guard-core from before CR-008 sends no status; its allowance is an active one.
        allowance: z
          .union([
            z.object({ status: z.literal('none'), delegate: z.string().min(1).max(128) }),
            z.object({
              status: z.literal('active').default('active'),
              cap: atomic,
              spent: atomic,
              resetsAt: z.iso.datetime({ offset: true }),
              delegate: z.string().min(1).max(128),
            }),
          ])
          .nullable(),
      }),
    )
    .max(16),
})

/** Since the agent's first shadowed payment: what shadow mode would have spent, and how often. */
export interface ShadowTotal {
  since: string
  total: string
  count: number
}

/** A guard-core without shadow mode leaves both out. */
export type Budget = BudgetView & { shadowSpentToday?: string; shadow?: ShadowTotal }

const budgetView = z.object({
  spentToday: atomic,
  shadowSpentToday: atomic.optional(),
  shadow: z
    .object({
      since: z.iso.datetime({ offset: true }),
      total: atomic,
      count: z.number().int().nonnegative(),
    })
    .optional(),
  dailyMax: atomic,
  perTxMax: atomic,
  hotWalletBalances: z.record(z.string(), atomic),
  paused: z.boolean(),
})

const count = z.number().int().nonnegative()

const report = z.object({
  agents: z
    .array(
      z.object({
        agentId: z.string().min(1).max(64),
        spent: atomic,
        payments: count,
        refused: z.record(z.string().min(1).max(64), count),
        domains: z.array(z.object({ domain: z.string().min(1).max(253), spent: atomic })).max(500),
      }),
    )
    .max(1000),
})

/** The calls every guard-core client makes: a bearer token, JSON, and a 10-second ceiling. */
export function requester(options: GuardClientOptions) {
  const fetchImpl = options.fetch ?? fetch

  async function call(token: string, method: string, path: string, body?: unknown) {
    return fetchImpl(`${options.url}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
  }

  return {
    call,
    admin: (method: string, path: string, body?: unknown) =>
      call(options.adminToken, method, path, body),
    async ok(response: Response): Promise<unknown> {
      if (!response.ok) {
        throw new GuardError(response.status)
      }
      return response.json()
    },
  }
}

export function httpGuardClient(options: GuardClientOptions): GuardClient {
  const fetchImpl = options.fetch ?? fetch
  const { call, admin, ok } = requester(options)

  return {
    async decide(intentId, decision, telegramUserId) {
      const response = await call(options.botToken, 'POST', '/v1/bot/decision', {
        intentId,
        decision,
        telegramUserId: String(telegramUserId),
      })
      if (response.status === 404) {
        return { ok: false, reason: 'not_found' }
      }
      if (response.status === 409) {
        return { ok: false, reason: conflict.parse(await response.json()).error }
      }
      return { ok: true, intent: payIntent.parse(await ok(response)) }
    },

    async decideMandate(mandateId, decision, telegramUserId) {
      const response = await call(
        options.botToken,
        'POST',
        `/v1/bot/mandates/${encodeURIComponent(mandateId)}/decision`,
        { decision, telegramUserId: String(telegramUserId) },
      )
      if (response.status === 404) {
        return { ok: false, reason: 'not_found' }
      }
      if (response.status === 409 || response.status === 410) {
        return { ok: false, reason: conflict.parse(await response.json()).error }
      }
      mandate.parse(await ok(response))
      return { ok: true }
    },

    async setPaused(agentId, paused) {
      const response = await admin('POST', paused ? '/v1/admin/pause' : '/v1/admin/resume', {
        agentId,
      })
      if (response.status === 404) {
        return 'not_found'
      }
      await ok(response)
      return 'ok'
    },

    async kill() {
      return killResult.parse(await ok(await admin('POST', '/v1/admin/kill', {})))
    },

    async budget(agentId) {
      const response = await admin('GET', `/v1/admin/budget/${encodeURIComponent(agentId)}`)
      // Until CR-004 lands the route itself is missing, and Fastify's 404 for that has a different
      // body: only guard-core's own answer means the agent does not exist.
      if (response.status === 404 && notFound.safeParse(await response.json()).success) {
        return undefined
      }
      return budgetView.parse(await ok(response))
    },

    async chains() {
      const response = await admin('GET', '/v1/admin/chains')
      if (response.status === 404) {
        return undefined
      }
      return chainList.parse(await ok(response)).chains
    },

    async report(from, to) {
      const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
      const response = await admin('GET', `/v1/admin/report?${query}`)
      if (response.status === 404) {
        return undefined
      }
      return report.parse(await ok(response)).agents
    },

    async healthy() {
      try {
        const response = await fetchImpl(`${options.url}/health`, {
          signal: AbortSignal.timeout(5_000),
        })
        return response.ok
      } catch {
        return false
      }
    },
  }
}
