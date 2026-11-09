import type { Policy } from '@agentguard/shared'
import { z } from 'zod'
import { toBaseUnits } from './amount.js'
import type { Answers, Preset } from './answers.js'
import { NETWORKS, usdToken } from './networks.js'

/** CR-011's presets, in dollars: per payment, per day, and the owner's approval at or above. */
export const PRESETS: Record<Preset, { perTx: string; daily: string; approval: string }> = {
  careful: { perTx: '1', daily: '5', approval: '0.5' },
  standard: { perTx: '5', daily: '20', approval: '1' },
}

const min = (...values: bigint[]) => values.reduce((a, b) => (b < a ? b : a))

/**
 * The first agent's policy: the preset, in shadow mode, paying no domain and no recipient until the
 * owner allows one. The offchain day may not exceed the smallest onchain cap: above it a payment
 * passes the policy and then fails at the top-up, which tells the owner nothing.
 */
export function presetPolicy(answers: Answers): Omit<Policy, 'agentId'> {
  const preset = PRESETS[answers.preset]
  const caps = answers.networks.map((network) => BigInt(answers.caps[network] ?? '0'))
  const dailyMax = min(toBaseUnits(preset.daily), ...caps)
  return {
    chains: answers.networks.map((network) => NETWORKS[network].chain),
    tokens: answers.networks.map(usdToken),
    perTxMax: min(toBaseUnits(preset.perTx), dailyMax).toString(),
    dailyMax: dailyMax.toString(),
    approvalThreshold: toBaseUnits(preset.approval).toString(),
    allowedRecipients: [],
    allowedDomains: [],
    paused: false,
    mode: 'shadow',
  }
}

/** What PUT /v1/admin/policy answers: a guard-core older than SPEC v0.6 drops `mode`. */
export const policyResponse = z.object({
  agentId: z.string(),
  mode: z.enum(['live', 'shadow']).optional(),
})

export const createdAgent = z.object({
  agentId: z.string(),
  token: z.string().min(16).max(512),
})

/** create-agent.ts prints the token alone on its last line. */
export function tokenFromScript(output: string): string | undefined {
  const last = output.trim().split('\n').pop()?.trim() ?? ''
  return /^[0-9a-f]{64}$/.test(last) ? last : undefined
}
