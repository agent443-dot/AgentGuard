import type { DoctorCheck } from '@agentguard/shared'
import { z } from 'zod'
import { formatUsd } from './amount.js'
import { labelOf } from './networks.js'

const amount = z.string().regex(/^(0|[1-9]\d*)$/)

export const doctorResponse = z.object({
  checks: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['ok', 'warn', 'fail']),
      message: z.string(),
      fix: z.string().optional(),
    }),
  ),
})

export const chainsResponse = z.object({
  chains: z.array(
    z.object({
      chain: z.string(),
      allowance: z
        .discriminatedUnion('status', [
          z.object({ status: z.literal('active'), cap: amount, spent: amount }),
          z.object({ status: z.literal('none') }),
        ])
        .nullable(),
    }),
  ),
})
export type ChainsResponse = z.infer<typeof chainsResponse>

const ICONS = { ok: '✅', warn: '⚠️ ', fail: '❌' } as const

export function printChecks(checks: DoctorCheck[]): string[] {
  return checks.flatMap((check) => [
    `${ICONS[check.status]} ${check.message}`,
    ...(check.fix === undefined ? [] : [`   fix: ${check.fix}`]),
  ])
}

export function failed(checks: DoctorCheck[]): boolean {
  return checks.some((check) => check.status === 'fail')
}

/**
 * For a guard-core older than SPEC v0.7, which has no doctor route: what /health and
 * /v1/admin/chains alone can tell.
 */
export function fallbackChecks(
  guardApp: string,
  healthy: boolean,
  chains: ChainsResponse | null,
): DoctorCheck[] {
  const logs = `read the log: fly logs --app ${guardApp} --no-tail`
  if (!healthy) {
    return [
      {
        id: 'guard',
        status: 'fail',
        message: 'guard-core does not answer on its private address',
        fix: logs,
      },
    ]
  }
  const guard: DoctorCheck = { id: 'guard', status: 'ok', message: 'guard-core answers' }
  if (chains === null) {
    return [
      guard,
      { id: 'chains', status: 'fail', message: 'guard-core did not list its chains', fix: logs },
    ]
  }
  if (chains.chains.length === 0) {
    return [
      guard,
      {
        id: 'chains',
        status: 'fail',
        message: 'No chain is configured, so every payment is refused',
        fix: 'set the chain secrets with create-agentguard, then deploy again',
      },
    ]
  }
  return [guard, ...chains.chains.map(chainCheck)]
}

function chainCheck({ chain, allowance }: ChainsResponse['chains'][number]): DoctorCheck {
  const id = `allowance:${chain}`
  const label = labelOf(chain)
  if (allowance === null) {
    return {
      id,
      status: 'fail',
      message: `${label}: the onchain cap could not be read`,
      fix: "check guard-core's RPC URL for this chain",
    }
  }
  if (allowance.status === 'none') {
    return {
      id,
      status: 'warn',
      message: `${label}: no onchain limit (killed, or never added)`,
      fix: 'add the cap again from your signing page',
    }
  }
  const cap = formatUsd(BigInt(allowance.cap))
  const spent = formatUsd(BigInt(allowance.spent))
  return { id, status: 'ok', message: `${label}: daily cap ${cap}, ${spent} spent today` }
}
