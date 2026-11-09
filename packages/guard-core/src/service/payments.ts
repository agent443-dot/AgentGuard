import type { ChainAdapter } from '@agentguard/onchain'
import type {
  ApprovalFlag,
  ChainId,
  PayIntent,
  RejectCode,
  SimulationResult,
} from '@agentguard/shared'
import type { FastifyBaseLogger } from 'fastify'
import { randomUUID } from 'node:crypto'
import type { BotNotifier } from '../adapters/bot.js'
import type { Db } from '../db/client.js'
import { getPin } from '../db/pins.js'
import * as repo from '../db/repo.js'
import { parseAmount, toAmount } from '../domain/amount.js'
import { pinFlags } from '../domain/pinning.js'
import { evaluate, POLICY_DEFAULTS } from '../domain/policy.js'
import { checkSimulation } from '../domain/simulation.js'
import { expirePending, expiresAt, requestApproval } from './approvals.js'
import { notify } from './events.js'
import type { Serial } from './serial.js'
import { redactUrls } from '../domain/redact.js'

export interface PaymentDeps {
  db: Db
  chains: ReadonlyMap<ChainId, ChainAdapter>
  /** USDC per served chain, from chains.ts' usdcFor. */
  usdc: ReadonlyMap<ChainId, string>
  bot: BotNotifier
  now: () => Date
  serial: Serial
  log: Pick<FastifyBaseLogger, 'warn' | 'error'>
}

export type Terms = Pick<
  PayIntent,
  'agentId' | 'kind' | 'chain' | 'token' | 'amount' | 'recipient' | 'reason' | 'domain'
>

export function newIntent(terms: Terms, now: Date): PayIntent {
  // Rejected until something clears it: an intent that escapes the pipeline early stays denied.
  return {
    ...terms,
    id: randomUUID(),
    status: 'rejected',
    rejectReasons: [],
    createdAt: now.toISOString(),
    expiresAt: expiresAt(now),
  }
}

export type Clearance =
  | { cleared: false; intent: PayIntent }
  | { cleared: true; intent: PayIntent; adapter: ChainAdapter }

/**
 * Policy, then simulation, then the owner if the amount calls for it. Persists and audits whatever
 * it decides. `ownerApproved` answers the approval threshold and nothing else: the rest of the
 * policy and the simulation run again, because the owner may have paused the agent or the day's
 * budget may have gone since they pressed the button.
 */
export async function clear(
  deps: PaymentDeps,
  intent: PayIntent,
  ownerApproved: boolean,
): Promise<Clearance> {
  const { db, now } = deps
  repo.saveIntent(db, intent)
  // Read here, under the agent's lock, not when the request arrived: a pause, a kill or a tighter
  // policy must reach a payment that was already waiting its turn. No policy allows nothing.
  const policy = repo.getPolicy(db, intent.agentId)
  if (policy === undefined) {
    return { cleared: false, intent: reject(deps, intent, ['PAUSED']) }
  }
  const adapter = deps.chains.get(intent.chain)
  const verdict = evaluate(intent, policy, repo.spentToday(db, intent.agentId, repo.utcDay(now())))
  const reasons = [...verdict.reasons]
  if (adapter === undefined && !reasons.includes('CHAIN_NOT_ALLOWED')) {
    reasons.push('CHAIN_NOT_ALLOWED')
  }
  // The owner's approval has already answered a pin's question, so it is not asked again.
  const flags =
    ownerApproved || intent.domain === undefined || intent.kind !== 'x402'
      ? []
      : pinFlags(
          getPin(db, intent.agentId, intent.domain),
          intent,
          policy.priceIncreaseMaxPct ?? POLICY_DEFAULTS.priceIncreaseMaxPct,
        )
  repo.audit(
    db,
    {
      event: 'policy_evaluated',
      intentId: intent.id,
      agentId: intent.agentId,
      decision:
        reasons.length > 0 ? 'reject' : flags.length > 0 ? 'needs_approval' : verdict.decision,
      reasons,
      ...(flags.length > 0 ? { detail: { flags } } : {}),
    },
    now(),
  )
  if (adapter === undefined || reasons.length > 0) {
    return { cleared: false, intent: reject(deps, intent, reasons) }
  }

  const { simulation, reasons: simReasons, error } = await simulate(deps, adapter, intent)
  repo.audit(
    db,
    {
      event: 'simulated',
      intentId: intent.id,
      agentId: intent.agentId,
      reasons: simReasons,
      detail: { summary: simulation?.summary, error },
    },
    now(),
  )
  if (simulation === undefined || simReasons.length > 0) {
    return { cleared: false, intent: reject(deps, intent, simReasons) }
  }

  if ((verdict.decision === 'needs_approval' || flags.length > 0) && !ownerApproved) {
    return { cleared: false, intent: await askOwner(deps, intent, simulation, flags) }
  }

  const approved: PayIntent = { ...intent, status: 'approved', rejectReasons: [] }
  repo.saveIntent(db, approved)
  return { cleared: true, intent: approved, adapter }
}

/** Nothing is signed unless the simulation found nothing to object to. */
async function simulate(
  deps: PaymentDeps,
  adapter: ChainAdapter,
  intent: PayIntent,
): Promise<{ simulation?: SimulationResult; reasons: RejectCode[]; error?: string }> {
  try {
    const outcome = await adapter.simulate(intent)
    const reasons =
      outcome.rejectReasons.length > 0
        ? outcome.rejectReasons
        : checkSimulation(outcome.simulation, intent)
    return { simulation: outcome.simulation, reasons }
  } catch (thrown) {
    // Without the adapter's message a SIM_FAILED on a live chain leaves nothing to debug from.
    const error = String(redactUrls(thrown instanceof Error ? thrown.message : String(thrown)))
    deps.log.warn({ intentId: intent.id, chain: intent.chain, error }, 'simulation failed')
    return { reasons: ['SIM_FAILED'], error }
  }
}

async function askOwner(
  deps: PaymentDeps,
  intent: PayIntent,
  simulation: SimulationResult,
  flags: ApprovalFlag[],
): Promise<PayIntent> {
  const pending: PayIntent = { ...intent, status: 'pending_approval', rejectReasons: [] }
  try {
    await requestApproval(deps.db, deps.bot, pending, simulation, flags)
    repo.audit(
      deps.db,
      { event: 'approval_requested', intentId: intent.id, agentId: intent.agentId },
      deps.now(),
    )
  } catch (error) {
    // The intent is already saved as pending, so the expiry sweep closes it if the bot never hears.
    deps.log.warn({ err: error, intentId: intent.id }, 'approval webhook failed')
    repo.audit(
      deps.db,
      { event: 'approval_request_failed', intentId: intent.id, agentId: intent.agentId },
      deps.now(),
    )
  }
  return pending
}

export function reject(deps: PaymentDeps, intent: PayIntent, reasons: RejectCode[]): PayIntent {
  const rejected: PayIntent = { ...intent, status: 'rejected', rejectReasons: reasons }
  repo.saveIntent(deps.db, rejected)
  repo.audit(
    deps.db,
    {
      event: 'rejected',
      intentId: intent.id,
      agentId: intent.agentId,
      decision: 'reject',
      reasons,
    },
    deps.now(),
  )
  notify(deps, rejected)
  return rejected
}

/** Tops the hot wallet up by the shortfall. The onchain cap bounds what this can ever pull. */
export async function fund(deps: PaymentDeps, adapter: ChainAdapter, intent: PayIntent) {
  const balance = parseAmount(await adapter.getHotWalletBalance(intent.token))
  const amount = parseAmount(intent.amount)
  if (balance >= amount) {
    return
  }
  const shortfall = toAmount(amount - balance)
  const txId = await adapter.topUpHotWallet(shortfall)
  repo.audit(
    deps.db,
    {
      event: 'topped_up',
      intentId: intent.id,
      agentId: intent.agentId,
      detail: { chain: intent.chain, amount: shortfall, txId },
    },
    deps.now(),
  )
}

/**
 * Counted as soon as a signed transaction leaves our hands, whether or not we learn that it landed.
 * Overcounting only shrinks what the agent has left today; undercounting would let it past the max.
 */
export function recordSpend(deps: PaymentDeps, intent: PayIntent): void {
  repo.addSpend(deps.db, intent.agentId, intent.chain, repo.utcDay(deps.now()), intent.amount)
}

export function finish(
  deps: PaymentDeps,
  intent: PayIntent,
  outcome: { status: 'executed' | 'failed'; txId?: string; reasons?: RejectCode[] },
): PayIntent {
  const done: PayIntent = {
    ...intent,
    status: outcome.status,
    rejectReasons: outcome.reasons ?? [],
    ...(outcome.txId === undefined ? {} : { txId: outcome.txId }),
  }
  repo.saveIntent(deps.db, done)
  repo.audit(
    deps.db,
    {
      event: outcome.status,
      intentId: intent.id,
      agentId: intent.agentId,
      reasons: done.rejectReasons,
      detail: { chain: intent.chain, amount: intent.amount, txId: outcome.txId },
    },
    deps.now(),
  )
  notify(deps, done)
  return done
}

/** Expires what the owner and the agents left waiting, and tells the bot about each one. */
export function sweep(deps: PaymentDeps): number {
  const expired = expirePending(deps.db, deps.now())
  for (const id of expired) {
    const intent = repo.getIntent(deps.db, id)
    if (intent !== undefined) {
      notify(deps, intent)
    }
  }
  return expired.length
}
