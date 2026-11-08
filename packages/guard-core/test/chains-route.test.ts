import { CHAINS } from '@agentguard/shared'
import { describe, expect, it, vi } from 'vitest'
import { StubChain } from '../src/adapters/stub.js'
import { loadConfig } from '../src/config.js'
import { createAgent } from '../src/db/agents.js'
import { migrateDb, openDb } from '../src/db/client.js'
import { putPolicy } from '../src/db/repo.js'
import { buildServer } from '../src/http/server.js'

const ADMIN = 'a'.repeat(64)

async function setup(chains: StubChain[], policyChains: string[]) {
  const db = openDb(':memory:')
  migrateDb(db)
  const token = createAgent(db, 'agent-1')
  putPolicy(
    db,
    {
      agentId: 'agent-1',
      chains: policyChains,
      tokens: [],
      perTxMax: '0',
      dailyMax: '0',
      approvalThreshold: '0',
      allowedRecipients: [],
      allowedDomains: [],
      paused: false,
    },
    new Date().toISOString(),
  )
  const app = await buildServer({
    db,
    config: loadConfig({
      ADMIN_TOKEN: ADMIN,
      BOT_TOKEN: 'b'.repeat(64),
      BOT_URL: 'http://bot.local',
      BOT_WEBHOOK_SECRET: 'c'.repeat(64),
      LOG_LEVEL: 'fatal',
    }),
    chains: new Map(chains.map((chain) => [chain.chain, chain])),
  })
  const get = (url: string, bearer: string) =>
    app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${bearer}` } })
  return { token, get }
}

describe('BudgetView.chains (CR-006)', () => {
  it('lists only the chains guard-core runs and the policy allows, on both budget routes', async () => {
    const { token, get } = await setup(
      [new StubChain(CHAINS.solanaDevnet), new StubChain(CHAINS.baseSepolia)],
      [CHAINS.solanaDevnet, CHAINS.base],
    )
    const asAgent = await get('/v1/agent/budget/agent-1', token)
    const asAdmin = await get('/v1/admin/budget/agent-1', ADMIN)
    expect(asAgent.json().chains).toEqual([CHAINS.solanaDevnet])
    expect(asAdmin.json().chains).toEqual([CHAINS.solanaDevnet])
  })

  it('is empty when the policy allows nothing guard-core runs', async () => {
    const { token, get } = await setup([new StubChain(CHAINS.solanaDevnet)], [])
    expect((await get('/v1/agent/budget/agent-1', token)).json().chains).toEqual([])
  })
})

describe('GET /v1/admin/chains (CR-006)', () => {
  it('lists every configured chain with its allowance, null where it cannot be read', async () => {
    const solana = new StubChain(CHAINS.solanaDevnet)
    const base = new StubChain(CHAINS.baseSepolia)
    vi.spyOn(base, 'getAllowanceState').mockRejectedValue(new Error('rpc down'))
    const { get } = await setup([solana, base], [])
    const res = await get('/v1/admin/chains', ADMIN)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      chains: [
        { chain: CHAINS.solanaDevnet, allowance: await solana.getAllowanceState() },
        { chain: CHAINS.baseSepolia, allowance: null },
      ],
    })
  })

  // CR-008: after a kill there is no limit at all. That is a state the owner must see, not a read
  // failure, and never an active limit with a zero cap.
  it('passes a chain with no onchain limit through as none, not null and not a zero cap', async () => {
    const solana = new StubChain(CHAINS.solanaDevnet)
    vi.spyOn(solana, 'getAllowanceState').mockResolvedValue({ status: 'none', delegate: 'hot' })
    const { get } = await setup([solana], [])
    expect((await get('/v1/admin/chains', ADMIN)).json()).toEqual({
      chains: [{ chain: CHAINS.solanaDevnet, allowance: { status: 'none', delegate: 'hot' } }],
    })
  })

  it('answers an empty list when no chain is configured', async () => {
    const { get } = await setup([], [])
    expect((await get('/v1/admin/chains', ADMIN)).json()).toEqual({ chains: [] })
  })

  it.each([
    ['an agent token', 'agent'],
    ['the bot token', 'b'.repeat(64)],
    ['no valid token', 'nope'],
  ])('refuses %s', async (_case, bearer) => {
    const { token, get } = await setup([new StubChain(CHAINS.solanaDevnet)], [])
    const res = await get('/v1/admin/chains', bearer === 'agent' ? token : bearer)
    expect(res.statusCode).toBe(401)
  })
})
