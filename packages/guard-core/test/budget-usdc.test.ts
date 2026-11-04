import { CHAINS } from '@agentguard/shared'
import { expect, it, vi } from 'vitest'
import { StubChain } from '../src/adapters/stub.js'
import { usdcFor } from '../src/chains.js'
import { loadConfig } from '../src/config.js'
import { createAgent } from '../src/db/agents.js'
import { migrateDb, openDb } from '../src/db/client.js'
import { putPolicy } from '../src/db/repo.js'
import { buildServer } from '../src/http/server.js'

const BASE_USDC = `0x${'e'.repeat(40)}`

it('reports the Base balance in the budget, from the same USDC the adapter was built with', async () => {
  const config = loadConfig({
    ADMIN_TOKEN: 'a'.repeat(64),
    BOT_TOKEN: 'b'.repeat(64),
    BOT_URL: 'http://bot.local',
    BOT_WEBHOOK_SECRET: 'c'.repeat(64),
    LOG_LEVEL: 'fatal',
    BASE_CHAIN: CHAINS.base,
    BASE_USDC,
  })
  const db = openDb(':memory:')
  migrateDb(db)
  const token = createAgent(db, 'agent-1')
  putPolicy(
    db,
    {
      agentId: 'agent-1',
      chains: [CHAINS.base, CHAINS.solanaDevnet],
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
  const base = new StubChain(CHAINS.base, 7_000_000n)
  const solana = new StubChain(CHAINS.solanaDevnet, 3_000_000n)
  const asked = vi.spyOn(base, 'getHotWalletBalance')
  const app = await buildServer({
    db,
    config,
    chains: new Map([
      [CHAINS.base, base],
      [CHAINS.solanaDevnet, solana],
    ]),
  })

  const res = await app.inject({
    method: 'GET',
    url: '/v1/agent/budget/agent-1',
    headers: { authorization: `Bearer ${token}` },
  })
  expect(res.json().hotWalletBalances).toEqual({
    [CHAINS.base]: '7000000',
    [CHAINS.solanaDevnet]: '3000000',
  })
  expect(asked).toHaveBeenCalledWith(usdcFor(config, CHAINS.base))
  expect(usdcFor(config, CHAINS.base)).toBe(BASE_USDC)
})
