import type { AgentSummary, DoctorCheck, Policy } from '@agentguard/shared'
import { z } from 'zod'
import { type GuardClientOptions, requester } from './guard.js'

/** What the owner runs from Telegram instead of a terminal: agents, policies and the doctor. */
export interface AdminClient {
  /** Undefined when the agent already exists. The token is returned once and never logged. */
  createAgent(agentId: string): Promise<{ agentId: string; token: string } | undefined>
  listAgents(): Promise<AgentSummary[]>
  /** False for an unknown agent. */
  revokeAgent(agentId: string): Promise<boolean>
  /** Undefined for an unknown agent. */
  policy(agentId: string): Promise<Policy | undefined>
  putPolicy(policy: Policy): Promise<Policy>
  doctor(): Promise<DoctorCheck[]>
  /** A one-time code for guard-core's passkey enrol page. Never logged. */
  enrolCode(): Promise<{ code: string; expiresAt: string }>
}

const atomic = z.string().regex(/^(0|[1-9]\d*)$/)
const id = z.string().min(1).max(64)
const address = z.string().min(1).max(128)

export const policySchema = z.object({
  agentId: id,
  chains: z.array(z.string().min(3).max(64)).max(16),
  tokens: z.array(address).max(32),
  perTxMax: atomic,
  dailyMax: atomic,
  approvalThreshold: atomic,
  allowedRecipients: z.array(address).max(256),
  allowedDomains: z.array(z.string().min(1).max(253)).max(256),
  paused: z.boolean(),
  mode: z.enum(['live', 'shadow']).optional(),
  priceIncreaseMaxPct: z.number().optional(),
  maxPaymentsPerMinute: z.number().optional(),
  requireMandate: z.boolean().optional(),
})

const created = z.object({ agentId: id, token: z.string().min(16).max(512) })

const agents = z.object({
  agents: z
    .array(z.object({ agentId: id, paused: z.boolean(), mode: z.enum(['live', 'shadow']) }))
    .max(1000),
})

const checks = z.object({
  checks: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        status: z.enum(['ok', 'warn', 'fail']),
        message: z.string().max(500),
        fix: z.string().max(500).optional(),
      }),
    )
    .max(64),
})

const enrol = z.object({
  code: z.string().min(8).max(256),
  expiresAt: z.iso.datetime({ offset: true }),
})

export function httpAdminClient(options: GuardClientOptions): AdminClient {
  const { admin, ok } = requester(options)
  const path = (agentId: string) => encodeURIComponent(agentId)

  return {
    async createAgent(agentId) {
      const response = await admin('POST', '/v1/admin/agents', { agentId })
      return response.status === 409 ? undefined : created.parse(await ok(response))
    },

    async listAgents() {
      return agents.parse(await ok(await admin('GET', '/v1/admin/agents'))).agents
    },

    async revokeAgent(agentId) {
      const response = await admin('POST', `/v1/admin/agents/${path(agentId)}/revoke`, {})
      if (response.status === 404) {
        return false
      }
      await ok(response)
      return true
    },

    async policy(agentId) {
      const response = await admin('GET', `/v1/admin/policy/${path(agentId)}`)
      return response.status === 404 ? undefined : policySchema.parse(await ok(response))
    },

    async putPolicy({ agentId, ...body }) {
      const response = await admin('PUT', `/v1/admin/policy/${path(agentId)}`, body)
      return policySchema.parse(await ok(response))
    },

    async enrolCode() {
      return enrol.parse(await ok(await admin('POST', '/v1/admin/passkeys/code', {})))
    },

    async doctor() {
      return checks.parse(await ok(await admin('GET', '/v1/admin/doctor'))).checks
    },
  }
}
