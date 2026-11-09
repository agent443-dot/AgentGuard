import type { ChainAdapter } from '@agentguard/onchain'
import type { PayIntent } from '@agentguard/shared'
import * as repo from '../db/repo.js'
import type { TransferRequest } from '../http/schemas.js'
import { clear, finish, fund, newIntent, recordSpend, type PaymentDeps } from './payments.js'

export async function transfer(deps: PaymentDeps, request: TransferRequest): Promise<PayIntent> {
  return deps.serial(request.agentId, async () => {
    const intent = newIntent({ ...request, kind: 'transfer' }, deps.now())
    const clearance = await clear(deps, intent, false)
    return clearance.cleared ? send(deps, clearance.adapter, clearance.intent) : clearance.intent
  })
}

/** Sends a transfer the owner approved, after checking it again against the policy and the chain. */
export async function sendApproved(deps: PaymentDeps, id: string): Promise<PayIntent | undefined> {
  const first = repo.getIntent(deps.db, id)
  if (first === undefined) {
    return undefined
  }
  return deps.serial(first.agentId, async () => {
    const intent = repo.getIntent(deps.db, id)
    if (intent?.status !== 'approved' || intent.kind !== 'transfer') {
      return intent
    }
    const clearance = await clear(deps, intent, true)
    return clearance.cleared ? send(deps, clearance.adapter, clearance.intent) : clearance.intent
  })
}

async function send(deps: PaymentDeps, adapter: ChainAdapter, intent: PayIntent) {
  try {
    await fund(deps, adapter, intent)
  } catch (error) {
    deps.log.error({ err: error, intentId: intent.id }, 'hot wallet top-up failed')
    return finish(deps, intent, { status: 'failed' })
  }
  try {
    const txId = await adapter.send(intent)
    recordSpend(deps, intent)
    return finish(deps, intent, { status: 'executed', txId })
  } catch (error) {
    // The transaction may have been broadcast before the error, so it counts.
    recordSpend(deps, intent)
    deps.log.error({ err: error, intentId: intent.id }, 'send failed')
    return finish(deps, intent, { status: 'failed' })
  }
}
