import type { BudgetView, PayIntent } from '@agentguard/shared'
import { z } from 'zod'
import type { OwnerTransaction } from '../domain/text.js'
import { payIntent } from '../http/schemas.js'

export type Decision = 'approve' | 'reject'

export type DecisionResult =
  | { ok: true; intent: PayIntent }
  | { ok: false; reason: 'not_found' | 'already_decided' | 'expired' }

export interface KillResult {
  pausedAgents: number
  ownerTransactions: OwnerTransaction[]
}

export interface GuardClient {
  decide(intentId: string, decision: Decision, telegramUserId: number): Promise<DecisionResult>
  setPaused(agentId: string, paused: boolean): Promise<'ok' | 'not_found'>
  kill(): Promise<KillResult>
  budget(agentId: string): Promise<BudgetView | undefined>
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
    z.union([
      z.object({ chain: z.string().min(1), description: z.string(), payload: z.unknown() }),
      z.object({ chain: z.string().min(1), error: z.string().max(200) }),
    ]),
  ),
})

const budgetView = z.object({
  spentToday: atomic,
  dailyMax: atomic,
  perTxMax: atomic,
  hotWalletBalances: z.record(z.string(), atomic),
  paused: z.boolean(),
})

export function httpGuardClient(options: GuardClientOptions): GuardClient {
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

  async function admin(method: string, path: string, body?: unknown) {
    return call(options.adminToken, method, path, body)
  }

  async function ok(response: Response): Promise<unknown> {
    if (!response.ok) {
      throw new GuardError(response.status)
    }
    return response.json()
  }

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
