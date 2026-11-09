import type { BudgetView, Mandate } from '@agentguard/shared'
import { z } from 'zod'

const intentStatus = z.enum([
  'approved',
  'pending_approval',
  'rejected',
  'executed',
  'failed',
  'expired',
  'shadowed',
])

const rejectReasons = z.array(z.string()).default([])

export const fetchResult = z
  .object({
    // Both are absent when the resource asked for no payment, and intentId is absent when the
    // host was refused before an intent existed.
    intentId: z.string().optional(),
    status: intentStatus.optional(),
    rejectReasons,
    response: z
      .object({
        status: z.number().int(),
        headers: z.record(z.string(), z.string()).default({}),
        body: z.unknown(),
      })
      .optional(),
  })
  .refine((result) => result.status !== undefined || result.response !== undefined)

export const transferResult = z.object({
  intentId: z.string(),
  status: intentStatus,
  txId: z.string().optional(),
  rejectReasons,
})

export const mandate = z.object({
  id: z.string(),
  agentId: z.string(),
  budget: z.string(),
  spent: z.string(),
  domains: z.array(z.string()),
  recipients: z.array(z.string()),
  reason: z.string(),
  status: z.enum(['pending_approval', 'active', 'exhausted', 'expired', 'revoked']),
  createdAt: z.string(),
  expiresAt: z.string(),
}) satisfies z.ZodType<Mandate>

/** Only what proves a receipt exists; the agent has no use for the rest. */
const receipt = z.object({ signature: z.string().min(1) })

export const budget = z.object({
  spentToday: z.string(),
  dailyMax: z.string(),
  perTxMax: z.string(),
  hotWalletBalances: z.record(z.string(), z.string()).default({}),
  paused: z.boolean(),
  // Absent means "not reported", per the shared type.
  chains: z.array(z.string()).optional(),
  // Absent from a guard-core older than task budgets and shadow mode.
  shadowSpentToday: z.string().optional(),
  mandates: z.array(mandate).optional(),
}) satisfies z.ZodType<BudgetView>

export const payIntent = z.object({
  id: z.string(),
  kind: z.enum(['x402', 'transfer']),
  chain: z.string(),
  amount: z.string(),
  recipient: z.string(),
  domain: z.string().optional(),
  status: intentStatus,
  rejectReasons,
  txId: z.string().optional(),
  createdAt: z.string(),
  expiresAt: z.string(),
})

export type FetchResult = z.infer<typeof fetchResult>
export type TransferResult = z.infer<typeof transferResult>
export type Budget = z.infer<typeof budget>
export type Intent = z.infer<typeof payIntent>

export interface FetchInput {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
  maxAmount?: string
  mandateId?: string
}

export interface TransferInput {
  chain: string
  token: string
  amount: string
  recipient: string
  reason: string
  mandateId?: string
}

export interface MandateInput {
  budget: string
  domains: string[]
  recipients?: string[]
  ttlSeconds: number
  reason: string
}

/** Everything the tools need from guard-core. Tests replace it; nothing here decides anything. */
export interface Guard {
  fetch(input: FetchInput): Promise<FetchResult>
  transfer(input: TransferInput): Promise<TransferResult>
  budget(): Promise<Budget>
  intent(id: string): Promise<Intent>
  startTask(input: MandateInput): Promise<Mandate>
  /** Whether guard-core holds a signed receipt for the intent. Its content is for the owner. */
  hasReceipt(id: string): Promise<boolean>
}

/** A guard-core call that did not produce a usable answer. `message` is safe to show the model. */
export class GuardError extends Error {
  constructor(
    readonly code: 'unreachable' | 'http' | 'bad_response',
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message)
  }
}

export interface HttpGuardOptions {
  baseUrl: string
  agentId: string
  token: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}

export function httpGuard(options: HttpGuardOptions): Guard {
  const { baseUrl, agentId, token, fetch = globalThis.fetch, timeoutMs = 60_000 } = options

  async function call<T>(schema: z.ZodType<T>, path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetch(new URL(path, baseUrl), {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (_error) {
      throw new GuardError(
        'unreachable',
        'AgentGuard could not be reached or did not answer in time. If this was a payment it may ' +
          'still have gone through: call get_budget before trying again.',
      )
    }
    if (!response.ok) {
      throw new GuardError('http', await errorText(response), response.status)
    }
    const parsed = schema.safeParse(await response.json().catch(() => undefined))
    if (!parsed.success) {
      throw new GuardError(
        'bad_response',
        'AgentGuard sent a response this server does not understand.',
      )
    }
    return parsed.data
  }

  const agent = encodeURIComponent(agentId)
  return {
    fetch: (input) => call(fetchResult, '/v1/agent/x402/fetch', { agentId, ...input }),
    transfer: (input) => call(transferResult, '/v1/agent/transfer', { agentId, ...input }),
    budget: () => call(budget, `/v1/agent/budget/${agent}`),
    intent: (id) => call(payIntent, `/v1/agent/intents/${encodeURIComponent(id)}`),
    startTask: (input) => call(mandate, '/v1/agent/mandates', { agentId, ...input }),
    hasReceipt: (id) =>
      call(receipt, `/v1/agent/intents/${encodeURIComponent(id)}/receipt`).then(
        () => true,
        (error: unknown) => {
          // 404 is the documented answer until the intent is executed.
          if (error instanceof GuardError && error.httpStatus === 404) {
            return false
          }
          throw error
        },
      ),
  }
}

const errorBody = z.object({
  error: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
})

async function errorText(response: Response): Promise<string> {
  const parsed = errorBody.safeParse(await response.json().catch(() => undefined))
  const detail = parsed.success ? parsed.data : undefined
  switch (response.status) {
    case 400: {
      const issues = detail?.issues?.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
      return `AgentGuard refused the request as invalid${issues ? ` (${issues})` : ''}.`
    }
    case 401:
    case 403:
      return "AgentGuard did not accept this agent's credentials. The owner needs to check the MCP server configuration."
    case 404:
      return 'AgentGuard has no record of that.'
    case 429:
      return 'AgentGuard is rate limiting this agent. Wait a minute before trying again.'
    default:
      return `AgentGuard returned an error (HTTP ${response.status}).`
  }
}
