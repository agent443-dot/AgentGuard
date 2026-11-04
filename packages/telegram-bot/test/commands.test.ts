import { CHAINS } from '@agentguard/shared'
import { describe, expect, it, vi } from 'vitest'
import { approval, command, fakeGuard, OWNER, press, sent, setup, STRANGER } from './support.js'

function lastReply(calls: ReturnType<typeof setup>['calls']): string {
  return String(sent(calls, 'sendMessage').at(-1)?.payload['text'])
}

describe('owner commands', () => {
  it('/status reports guard-core and the pending approvals', async () => {
    const { bot, desk, calls } = setup()
    await desk.post(approval())
    await bot.handleUpdate(command(OWNER, '/status'))
    expect(lastReply(calls)).toContain('guard-core: reachable')
    expect(lastReply(calls)).toContain('Pending approvals: 1')
  })

  it('/status lists every chain guard-core runs, with its onchain allowance', async () => {
    const chains = vi.fn().mockResolvedValue([
      {
        chain: CHAINS.solanaDevnet,
        allowance: {
          cap: '100000000',
          spent: '3000000',
          resetsAt: '2026-11-05T00:00:00Z',
          delegate: 'D',
        },
      },
      { chain: CHAINS.baseSepolia, allowance: null },
    ])
    const { bot, calls } = setup({ guard: fakeGuard({ chains }) })
    await bot.handleUpdate(command(OWNER, '/status'))
    const text = lastReply(calls)
    expect(text).toContain(
      '• Solana devnet: $3.00 of $100.00 onchain today, resets 2026-11-05 00:00:00 UTC',
    )
    expect(text).toContain('• Base Sepolia: <b>onchain allowance could not be read</b>')
  })

  it('/status still answers when guard-core cannot list its chains', async () => {
    const chains = vi.fn().mockRejectedValue(new Error('500'))
    const { bot, calls } = setup({ guard: fakeGuard({ chains }) })
    await bot.handleUpdate(command(OWNER, '/status'))
    expect(lastReply(calls)).toContain('guard-core: reachable')
    expect(lastReply(calls)).toContain('Chains: not reported')
  })

  it('/status does not ask for chains when guard-core is down', async () => {
    const guard = fakeGuard({ healthy: vi.fn().mockResolvedValue(false) })
    const { bot, calls } = setup({ guard })
    await bot.handleUpdate(command(OWNER, '/status'))
    expect(guard.chains).not.toHaveBeenCalled()
    expect(lastReply(calls)).not.toContain('Chains')
  })

  it('/budget shows the agent budget', async () => {
    const budget = vi.fn().mockResolvedValue({
      spentToday: '1000000',
      dailyMax: '20000000',
      perTxMax: '5000000',
      hotWalletBalances: {},
      paused: false,
    })
    const { bot, calls } = setup({ guard: fakeGuard({ budget }) })
    await bot.handleUpdate(command(OWNER, '/budget research-agent'))
    expect(budget).toHaveBeenCalledWith('research-agent')
    expect(lastReply(calls)).toContain('Spent today: $1.00 of $20.00')
  })

  it('/budget names an unknown agent and explains its usage', async () => {
    const { bot, calls } = setup()
    await bot.handleUpdate(command(OWNER, '/budget ghost'))
    expect(lastReply(calls)).toContain('No agent <code>ghost</code>')
    await bot.handleUpdate(command(OWNER, '/budget'))
    expect(lastReply(calls)).toBe('Usage: /budget &lt;agentId&gt;')
  })

  it('/pause and /resume call guard-core', async () => {
    const { bot, guard, calls } = setup()
    await bot.handleUpdate(command(OWNER, '/pause a1'))
    expect(guard.setPaused).toHaveBeenCalledWith('a1', true)
    expect(lastReply(calls)).toContain('Paused <code>a1</code>')
    await bot.handleUpdate(command(OWNER, '/resume a1'))
    expect(guard.setPaused).toHaveBeenCalledWith('a1', false)
    expect(lastReply(calls)).toContain('Resumed <code>a1</code>')
  })

  it('says so when guard-core is down', async () => {
    const setPaused = vi.fn().mockRejectedValue(new Error('timeout'))
    const { bot, calls } = setup({ guard: fakeGuard({ setPaused }) })
    await bot.handleUpdate(command(OWNER, '/pause a1'))
    expect(lastReply(calls)).toContain('guard-core did not answer')
  })

  it('ignores commands from strangers', async () => {
    const { bot, guard, calls } = setup()
    await bot.handleUpdate(command(STRANGER, '/kill'))
    await bot.handleUpdate(command(STRANGER, '/pause a1'))
    await bot.handleUpdate(press(STRANGER, 'kill:confirm'))
    expect(calls).toHaveLength(0)
    expect(guard.setPaused).not.toHaveBeenCalled()
    expect(guard.kill).not.toHaveBeenCalled()
  })
})

describe('/kill', () => {
  it('names both chains in the confirmation when guard-core reports them', async () => {
    const chains = vi.fn().mockResolvedValue([
      { chain: CHAINS.solanaDevnet, allowance: null },
      { chain: CHAINS.baseSepolia, allowance: null },
    ])
    const { bot, guard, calls } = setup({ guard: fakeGuard({ chains }) })
    await bot.handleUpdate(command(OWNER, '/kill'))
    expect(lastReply(calls)).toContain('prepares, for Solana devnet and Base Sepolia, the owner')
    expect(guard.kill).not.toHaveBeenCalled()
  })

  it('shows the owner transaction of each chain, Solana and Base, after confirming', async () => {
    const kill = vi.fn().mockResolvedValue({
      pausedAgents: 1,
      ownerTransactions: [
        {
          chain: CHAINS.solanaDevnet,
          description: 'Remove the spending limit',
          payload: { ix: 1 },
        },
        { chain: CHAINS.baseSepolia, description: 'Reset the allowance', payload: { to: '0xabc' } },
      ],
    })
    const { bot, calls } = setup({ guard: fakeGuard({ kill }) })
    await bot.handleUpdate(press(OWNER, 'kill:confirm'))
    expect(sent(calls, 'editMessageText')[0]?.payload['text']).toContain('Sign the 2 transactions')
    const [solana, base] = sent(calls, 'sendMessage').map((call) => String(call.payload['text']))
    expect(solana).toContain('<b>Solana devnet</b>: Remove the spending limit')
    expect(base).toContain('<b>Base Sepolia</b>: Reset the allowance')
  })

  it('asks first and does nothing until confirmed', async () => {
    const { bot, guard, calls } = setup()
    await bot.handleUpdate(command(OWNER, '/kill'))
    expect(guard.kill).not.toHaveBeenCalled()
    expect(JSON.stringify(sent(calls, 'sendMessage')[0]?.payload['reply_markup'])).toContain(
      'kill:confirm',
    )

    await bot.handleUpdate(press(OWNER, 'kill:cancel'))
    expect(guard.kill).not.toHaveBeenCalled()
    expect(sent(calls, 'editMessageText')[0]?.payload['text']).toContain('cancelled')
  })

  it('on confirm, shows each chain owner transaction', async () => {
    const kill = vi.fn().mockResolvedValue({
      pausedAgents: 2,
      ownerTransactions: [
        {
          chain: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
          description: 'Remove spending limit',
          payload: { ix: 1 },
        },
        { chain: 'eip155:84532', description: 'Reset allowance', payload: { to: '0xabc' } },
      ],
    })
    const { bot, calls } = setup({ guard: fakeGuard({ kill }) })
    await bot.handleUpdate(press(OWNER, 'kill:confirm'))

    expect(kill).toHaveBeenCalledOnce()
    expect(sent(calls, 'editMessageText')[0]?.payload['text']).toContain('Paused agents: 2')
    const txs = sent(calls, 'sendMessage').map((call) => String(call.payload['text']))
    expect(txs[0]).toContain('<b>Solana devnet</b>: Remove spending limit')
    expect(txs[1]).toContain('<b>Base Sepolia</b>: Reset allowance')
    expect(txs[1]).toContain('0xabc')
  })

  it('keeps the other chains when one owner transaction could not be built', async () => {
    const manual = 'Could not build the kill transaction. Remove the spend limit by hand.'
    const kill = vi.fn().mockResolvedValue({
      pausedAgents: 1,
      ownerTransactions: [
        { chain: 'eip155:84532', description: 'Reset allowance', payload: { to: '0xabc' } },
        { chain: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', description: manual, payload: null },
      ],
    })
    const { bot, calls } = setup({ guard: fakeGuard({ kill }) })
    await bot.handleUpdate(press(OWNER, 'kill:confirm'))

    const summary = String(sent(calls, 'editMessageText')[0]?.payload['text'])
    expect(summary).toContain('Paused agents: 1')
    expect(summary).toContain('Sign the transaction below')
    const [built, unbuilt] = sent(calls, 'sendMessage').map((call) => String(call.payload['text']))
    expect(built).toContain('<pre>')
    expect(unbuilt).toContain('<b>Solana devnet</b>: <b>no owner transaction could be built')
    expect(unbuilt).toContain(manual)
    expect(unbuilt).not.toContain('<pre>')
  })

  it('warns when the allowances are still live', async () => {
    const { bot, calls } = setup()
    await bot.handleUpdate(press(OWNER, 'kill:confirm'))
    expect(sent(calls, 'editMessageText')[0]?.payload['text']).toContain('still live')
  })

  it('reports a failed kill as not done', async () => {
    const kill = vi.fn().mockRejectedValue(new Error('down'))
    const { bot, calls } = setup({ guard: fakeGuard({ kill }) })
    await bot.handleUpdate(press(OWNER, 'kill:confirm'))
    expect(sent(calls, 'editMessageText')[0]?.payload['text']).toContain('Kill failed')
  })
})
