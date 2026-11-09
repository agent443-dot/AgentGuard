import { CHAINS } from '@agentguard/shared'
import { describe, expect, it, vi } from 'vitest'
import { StubChain } from '../src/adapters/stub.js'
import { loadConfig } from '../src/config.js'
import { createAgent } from '../src/db/agents.js'
import { migrateDb, openDb } from '../src/db/client.js'
import { putPolicy } from '../src/db/repo.js'
import { buildServer } from '../src/http/server.js'
import { offer, paid, paymentRequired } from './harness.js'

const BASE_USDC = `0x${'e'.repeat(40)}`
const PAY_TO = `0x${'d'.repeat(40)}`

describe('x402 on Base', () => {
  it('routes an eip155 offer to the Base adapter, leaving Solana untouched', async () => {
    const db = openDb(':memory:')
    migrateDb(db)
    const token = createAgent(db, 'agent-1')
    putPolicy(
      db,
      {
        agentId: 'agent-1',
        chains: [CHAINS.baseSepolia, CHAINS.solanaDevnet],
        tokens: [BASE_USDC],
        perTxMax: '5000000',
        dailyMax: '10000000',
        approvalThreshold: '2000000',
        allowedRecipients: [],
        allowedDomains: ['api.example.com'],
        paused: false,
        // A new agent starts in shadow mode; this one is switched live to pay.
        mode: 'live',
      },
      new Date().toISOString(),
    )
    const baseChain = new StubChain(CHAINS.baseSepolia, 100_000_000n)
    const solana = new StubChain(CHAINS.solanaDevnet, 100_000_000n)
    const onBase = vi.spyOn(baseChain, 'x402Scheme')
    const onSolana = vi.spyOn(solana, 'x402Scheme')

    const fetchMock = vi.fn<typeof fetch>(async (_url, init) =>
      new Headers(init?.headers).has('payment-signature')
        ? paid()
        : paymentRequired([
            offer({ network: CHAINS.baseSepolia, asset: BASE_USDC, payTo: PAY_TO, extra: {} }),
          ]),
    )
    const app = await buildServer({
      db,
      config: loadConfig({
        ADMIN_TOKEN: 'a'.repeat(64),
        BOT_TOKEN: 'b'.repeat(64),
        BOT_URL: 'http://bot.local',
        BOT_WEBHOOK_SECRET: 'c'.repeat(64),
        LOG_LEVEL: 'fatal',
      }),
      chains: new Map([
        [CHAINS.baseSepolia, baseChain],
        [CHAINS.solanaDevnet, solana],
      ]),
      fetch: fetchMock,
    })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/agent/x402/fetch',
      headers: { authorization: `Bearer ${token}` },
      payload: { agentId: 'agent-1', url: 'https://api.example.com/data' },
    })
    expect(res.json()).toMatchObject({ status: 'executed', rejectReasons: [] })
    expect(onBase).toHaveBeenCalledOnce()
    expect(onSolana).not.toHaveBeenCalled()
  })
})
