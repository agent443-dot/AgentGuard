import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_TOKEN, CHAIN, harness, type Harness } from './harness.js'

let h: Harness
beforeEach(async () => {
  h = await harness()
})

const admin = (url: string, payload: object = {}) =>
  h.app.inject({
    method: 'POST',
    url,
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    payload,
  })

describe('POST /v1/admin/kill (GC-7)', () => {
  it('pauses every agent and returns the owner transaction for each chain', async () => {
    const res = await admin('/v1/admin/kill')
    expect(res.json()).toEqual({
      pausedAgents: 1,
      ownerTransactions: [
        { chain: CHAIN, description: `stub: remove the spend limit on ${CHAIN}`, payload: {} },
      ],
    })
    expect(h.auditEvents()).toEqual(['killed'])
  })

  it('still pauses when a chain cannot build its transaction', async () => {
    vi.spyOn(h.chain, 'buildKillTx').mockRejectedValue(new Error('rpc down'))
    const res = await admin('/v1/admin/kill')
    expect(res.json()).toEqual({
      pausedAgents: 1,
      ownerTransactions: [{ chain: CHAIN, error: 'build_failed' }],
    })
    const budget = await h.agent('GET', '/v1/agent/budget/agent-1')
    expect(budget.json().paused).toBe(true)
  })
})

describe('audit of admin actions', () => {
  it('records pause and resume', async () => {
    await admin('/v1/admin/pause', { agentId: 'agent-1' })
    await admin('/v1/admin/resume', { agentId: 'agent-1' })
    expect(h.auditEvents()).toEqual(['paused', 'resumed'])
  })
})

it('answers 404 for a policy on an agent that does not exist', async () => {
  const res = await h.app.inject({
    method: 'PUT',
    url: '/v1/admin/policy/ghost',
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    payload: {
      chains: [],
      tokens: [],
      perTxMax: '0',
      dailyMax: '0',
      approvalThreshold: '0',
      allowedRecipients: [],
      allowedDomains: [],
      paused: false,
    },
  })
  expect(res.statusCode).toBe(404)
})

describe('GET /v1/agent/budget', () => {
  it('reports the hot wallet balance per chain', async () => {
    const res = await h.agent('GET', '/v1/agent/budget/agent-1')
    expect(res.json().hotWalletBalances).toEqual({ [CHAIN]: '100000000' })
  })

  it('leaves out a chain whose balance cannot be read', async () => {
    vi.spyOn(h.chain, 'getHotWalletBalance').mockRejectedValue(new Error('rpc down'))
    const res = await h.agent('GET', '/v1/agent/budget/agent-1')
    expect(res.json().hotWalletBalances).toEqual({})
  })
})
