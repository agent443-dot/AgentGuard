import { CHAINS } from '@agentguard/shared'
import { describe, expect, it, vi } from 'vitest'
import {
  approval,
  command,
  fakeGuard,
  NOW,
  OTHER_OWNER,
  OWNER,
  press,
  sent,
  setup,
  STRANGER,
} from './support.js'

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

const PHANTOM = (issued: Date) => `https://phantom.app/ul/browse/kill?issued=${issued.getTime()}`

function phantomButtons(call: { payload: Record<string, unknown> } | undefined): unknown[] {
  const markup = call?.payload['reply_markup'] as
    { inline_keyboard: { url?: string; text: string }[][] } | undefined
  return (markup?.inline_keyboard ?? []).flat().filter((button) => button.url !== undefined)
}

describe('/kill with the signing page configured', () => {
  const offerText = (call: { payload: Record<string, unknown> } | undefined) =>
    String(call?.payload['text'])

  it('offers no Phantom button before the guard-core kill is confirmed', async () => {
    const { bot, calls } = setup({ phantomKill: PHANTOM })
    await bot.handleUpdate(command(OWNER, '/kill'))
    const prompt = sent(calls, 'sendMessage')[0]
    expect(phantomButtons(prompt)).toEqual([])
    expect(offerText(prompt)).toContain('<b>Kill everything</b> pauses every agent')
    expect(offerText(prompt)).toContain(
      'Once guard-core confirms, you get <b>Open kill in Phantom</b>',
    )
  })

  it('offers it on the result of a kill guard-core confirmed', async () => {
    const { bot, calls } = setup({ phantomKill: PHANTOM })
    await bot.handleUpdate(press(OWNER, 'kill:confirm'))
    const done = sent(calls, 'editMessageText')[0]
    expect(offerText(done)).toContain('guard-core has paused 2 agents and signs no more payments')
    expect(offerText(done)).toContain('The Solana spending limit is still live onchain')
    expect(offerText(done)).toContain('expires in 15 minutes')
    expect(phantomButtons(done)).toEqual([{ text: 'Open kill in Phantom', url: PHANTOM(NOW) }])
  })

  it('keeps the onchain brake when guard-core did not confirm, and says plainly it is only half', async () => {
    let now = NOW
    const kill = vi.fn().mockRejectedValue(new Error('down'))
    const { bot, commands, calls } = setup({
      guard: fakeGuard({ kill }),
      phantomKill: PHANTOM,
      now: () => now,
    })
    await bot.handleUpdate(press(OWNER, 'kill:confirm', 11))
    const failed = sent(calls, 'editMessageText')[0]
    expect(offerText(failed)).toContain('guard-core did <b>NOT</b> confirm a pause')
    expect(offerText(failed)).toContain('only the onchain half of the kill')
    expect(phantomButtons(failed)).toEqual([
      { text: 'Remove onchain limit anyway (Phantom)', url: PHANTOM(NOW) },
    ])

    // Same rules as any other button: it expires after 15 minutes.
    now = new Date(NOW.getTime() + 15 * 60_000)
    await commands.expireKillOffers()
    const retired = sent(calls, 'editMessageText')[1]
    expect(retired?.payload['message_id']).toBe(11)
    expect(offerText(retired)).toContain('This Phantom button has expired')
    expect(phantomButtons(retired)).toEqual([])
  })

  it('retires the "anyway" button when a later kill succeeds', async () => {
    const kill = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ pausedAgents: 1, ownerTransactions: [] })
    const { bot, calls } = setup({ guard: fakeGuard({ kill }), phantomKill: PHANTOM })
    await bot.handleUpdate(press(OWNER, 'kill:confirm', 11))
    await bot.handleUpdate(press(OWNER, 'kill:confirm', 12))
    const edits = sent(calls, 'editMessageText')
    expect(edits.map((call) => call.payload['message_id'])).toEqual([11, 12, 11])
    expect(offerText(edits[2])).toContain('guard-core did <b>NOT</b> confirm a pause')
    expect(phantomButtons(edits[2])).toEqual([])
    expect(phantomButtons(edits[1])).toEqual([{ text: 'Open kill in Phantom', url: PHANTOM(NOW) }])
  })

  it('retires the older button when a newer kill result is posted, in any owner chat', async () => {
    const { bot, calls } = setup({ phantomKill: PHANTOM })
    await bot.handleUpdate(press(OWNER, 'kill:confirm', 11))
    await bot.handleUpdate(press(OTHER_OWNER, 'kill:confirm', 22))
    const edits = sent(calls, 'editMessageText')
    expect(edits.map((call) => call.payload['message_id'])).toEqual([11, 22, 11])
    const retired = edits[2]
    expect(retired?.payload['chat_id']).toBe(OWNER.id)
    expect(offerText(retired)).toContain('guard-core has paused 2 agents')
    expect(offerText(retired)).toContain(
      'This Phantom button has expired. Use /kill for a fresh one.',
    )
    expect(phantomButtons(retired)).toEqual([])
    expect(phantomButtons(edits[1])).toHaveLength(1)
  })

  it('issues each button its own link, stamped when the kill result is posted', async () => {
    let now = NOW
    const { bot, calls } = setup({ phantomKill: PHANTOM, now: () => now })
    await bot.handleUpdate(press(OWNER, 'kill:confirm', 11))
    now = new Date(NOW.getTime() + 60_000)
    await bot.handleUpdate(press(OWNER, 'kill:confirm', 12))
    const edits = sent(calls, 'editMessageText')
    expect(phantomButtons(edits[0])).toEqual([{ text: 'Open kill in Phantom', url: PHANTOM(NOW) }])
    expect(phantomButtons(edits[1])).toEqual([{ text: 'Open kill in Phantom', url: PHANTOM(now) }])
  })

  it('retires a button after 15 minutes, and not before', async () => {
    let now = NOW
    const { bot, commands, calls } = setup({ phantomKill: PHANTOM, now: () => now })
    await bot.handleUpdate(press(OWNER, 'kill:confirm', 11))

    now = new Date(NOW.getTime() + 15 * 60_000 - 1)
    await commands.expireKillOffers()
    expect(sent(calls, 'editMessageText')).toHaveLength(1)

    now = new Date(NOW.getTime() + 15 * 60_000)
    await commands.expireKillOffers()
    const retired = sent(calls, 'editMessageText')[1]
    expect(retired?.payload['message_id']).toBe(11)
    expect(offerText(retired)).toContain('This Phantom button has expired')
    expect(phantomButtons(retired)).toEqual([])

    await commands.expireKillOffers()
    expect(sent(calls, 'editMessageText')).toHaveLength(2)
  })

  it('shows no Phantom button at all without the signing page', async () => {
    const kill = vi
      .fn()
      .mockResolvedValueOnce({ pausedAgents: 1, ownerTransactions: [] })
      .mockRejectedValueOnce(new Error('down'))
    const { bot, commands, calls } = setup({ guard: fakeGuard({ kill }) })
    await bot.handleUpdate(command(OWNER, '/kill'))
    await bot.handleUpdate(press(OWNER, 'kill:confirm'))
    await bot.handleUpdate(press(OWNER, 'kill:confirm'))
    expect(offerText(sent(calls, 'editMessageText')[1])).toContain(
      'guard-core did not confirm. Assume nothing is paused',
    )
    await commands.expireKillOffers()
    expect(phantomButtons(sent(calls, 'sendMessage')[0])).toEqual([])
    expect(sent(calls, 'editMessageText').flatMap(phantomButtons)).toEqual([])
    expect(JSON.stringify(calls)).not.toContain('Phantom')
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
    expect(sent(calls, 'editMessageText')[0]?.payload['text']).toContain(
      'guard-core has paused 2 agents',
    )
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
    expect(summary).toContain('guard-core has paused 1 agent and')
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
