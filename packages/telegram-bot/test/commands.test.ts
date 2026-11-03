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
    const kill = vi.fn().mockResolvedValue({
      pausedAgents: 1,
      ownerTransactions: [
        { chain: 'eip155:84532', description: 'Reset allowance', payload: { to: '0xabc' } },
        { chain: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', error: 'build_failed' },
      ],
    })
    const { bot, calls } = setup({ guard: fakeGuard({ kill }) })
    await bot.handleUpdate(press(OWNER, 'kill:confirm'))

    expect(sent(calls, 'editMessageText')[0]?.payload['text']).toContain(
      'Sign the transaction below',
    )
    const [built, failed] = sent(calls, 'sendMessage').map((call) => String(call.payload['text']))
    expect(built).toContain('Reset allowance')
    expect(failed).toContain(
      '<b>Solana devnet</b>: <b>the owner transaction could not be built</b>',
    )
    expect(failed).toContain('still live')
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
