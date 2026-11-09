import { Writable } from 'node:stream'
import { pino } from 'pino'
import { describe, expect, it, vi } from 'vitest'
import {
  buttonData,
  command,
  fakeAdmin,
  fakeGuard,
  NOW,
  OTHER_OWNER,
  OWNER,
  policy,
  press,
  say,
  sent,
  setup,
} from './support.js'

const text = (call: { payload: Record<string, unknown> } | undefined) =>
  String(call?.payload['text'])
const last = (calls: Parameters<typeof sent>[0]) => sent(calls, 'sendMessage').at(-1)
const TOKEN = 'agt_' + 'z'.repeat(40)
const BUDGET = {
  spentToday: '0',
  dailyMax: '10000000',
  perTxMax: '2000000',
  hotWalletBalances: {},
  paused: false,
}

describe('/agent', () => {
  it('creates an agent, sends the token alone and deletes it after a minute', async () => {
    let now = NOW
    const { bot, owner, admin, calls } = setup({ now: () => now })
    await bot.handleUpdate(command(OWNER, '/agent new research-agent'))
    expect(admin.createAgent).toHaveBeenCalledWith('research-agent')
    const [info, token] = sent(calls, 'sendMessage')
    expect(text(info)).toContain('in <b>shadow mode</b> with a deny-all policy')
    expect(text(info)).toContain(
      '<code>pnpm --filter @agentguard/mcp-server run setup claude-code</code>',
    )
    expect(text(info)).not.toContain(TOKEN)
    expect(text(token)).toBe(
      `<code>${TOKEN}</code>\nCopy it now: this message deletes itself in about a minute.`,
    )

    now = new Date(NOW.getTime() + 59_999)
    await owner.sweep()
    expect(sent(calls, 'deleteMessage')).toHaveLength(0)
    now = new Date(NOW.getTime() + 60_000)
    await owner.sweep()
    await owner.sweep()
    expect(sent(calls, 'deleteMessage').map((call) => call.payload['message_id'])).toEqual([
      token?.messageId,
    ])
  })

  it('never writes the token to the log, even when its message fails', async () => {
    const lines: string[] = []
    const log = pino(
      { level: 'trace' },
      new Writable({
        write(chunk, _encoding, done) {
          lines.push(String(chunk))
          done()
        },
      }),
    )
    const { bot, calls } = setup({
      log,
      fail: (call) => String(call.payload['text']).includes(TOKEN),
    })
    await bot.handleUpdate(command(OWNER, '/agent new research-agent'))
    expect(text(last(calls))).toContain('Revoke this agent and create it again')
    expect(lines.join('')).toContain('agent token message failed')
    expect(lines.join('')).not.toContain(TOKEN)
  })

  it('says so when the agent exists, and shows usage for anything else', async () => {
    const admin = fakeAdmin({ createAgent: vi.fn(async () => undefined) })
    const { bot, calls } = setup({ admin })
    await bot.handleUpdate(command(OWNER, '/agent new research-agent'))
    await bot.handleUpdate(command(OWNER, '/agent rename x'))
    expect(sent(calls, 'sendMessage').map(text)).toEqual([
      'An agent <code>research-agent</code> already exists.',
      'Usage: /agent new &lt;id&gt;, /agent list, /agent revoke &lt;id&gt;',
    ])
  })

  it('lists agents with their mode', async () => {
    const { bot, calls } = setup()
    await bot.handleUpdate(command(OWNER, '/agent list'))
    expect(text(last(calls))).toBe('<b>Agents</b> (1)\n• <code>research-agent</code>: shadow')
  })

  it('revokes only from the confirm button, and only once', async () => {
    const { bot, admin, calls } = setup()
    await bot.handleUpdate(command(OWNER, '/agent revoke research-agent'))
    expect(admin.revokeAgent).not.toHaveBeenCalled()
    const data = buttonData(last(calls), 'Revoke')
    await bot.handleUpdate(press(OWNER, data))
    await bot.handleUpdate(press(OTHER_OWNER, data))
    expect(admin.revokeAgent).toHaveBeenCalledTimes(1)
    expect(text(sent(calls, 'editMessageText')[0])).toContain('Revoked <code>research-agent</code>')
    expect(sent(calls, 'answerCallbackQuery').at(-1)?.payload['text']).toContain('expired')
  })

  it('does nothing when Cancel is pressed', async () => {
    const { bot, admin, calls } = setup()
    await bot.handleUpdate(command(OWNER, '/agent revoke research-agent'))
    await bot.handleUpdate(press(OWNER, buttonData(last(calls), 'Cancel')))
    expect(admin.revokeAgent).not.toHaveBeenCalled()
    expect(text(sent(calls, 'editMessageText')[0])).toBe('Cancelled. Nothing changed.')
  })
})

describe('/policy', () => {
  it('shows the policy in dollars with the preset and edit buttons', async () => {
    const { bot, calls } = setup()
    await bot.handleUpdate(command(OWNER, '/policy research-agent'))
    const shown = last(calls)
    expect(text(shown)).toContain('Per payment: up to $2.00')
    expect(text(shown)).toContain('Owner approval: at or above $1.00')
    expect(text(shown)).toContain('Domains: <code>api.example.com</code>')
    expect(() => buttonData(shown, 'Careful')).not.toThrow()
    expect(() => buttonData(shown, 'Edit daily max')).not.toThrow()
  })

  it('applies a preset that only lowers limits at once', async () => {
    const { bot, admin, calls } = setup()
    await bot.handleUpdate(command(OWNER, '/policy research-agent'))
    await bot.handleUpdate(press(OWNER, buttonData(last(calls), 'Careful')))
    expect(admin.putPolicy).toHaveBeenCalledWith(
      policy({ perTxMax: '1000000', dailyMax: '5000000', approvalThreshold: '500000' }),
    )
    expect(text(last(calls))).toMatch(/^Saved\.\n<b>Policy<\/b>/)
  })

  it('asks before any raise, and applies it from the confirm', async () => {
    const { bot, admin, calls } = setup()
    await bot.handleUpdate(command(OWNER, '/policy research-agent'))
    await bot.handleUpdate(press(OWNER, buttonData(last(calls), 'Standard')))
    expect(admin.putPolicy).not.toHaveBeenCalled()
    const ask = last(calls)
    expect(text(ask)).toBe(
      [
        '<b>Raise the limits</b> of <code>research-agent</code>?',
        '• per payment max: $2.00 → <b>$5.00</b>',
        '• daily max: $10.00 → <b>$20.00</b>',
      ].join('\n'),
    )
    await bot.handleUpdate(press(OWNER, buttonData(ask, 'Raise')))
    expect(admin.putPolicy).toHaveBeenCalledWith(
      policy({ perTxMax: '5000000', dailyMax: '20000000', approvalThreshold: '1000000' }),
    )
  })

  it('edits one field from a reply in dollars, with bigint units', async () => {
    const { bot, admin, calls } = setup()
    await bot.handleUpdate(command(OWNER, '/policy research-agent'))
    await bot.handleUpdate(press(OWNER, buttonData(last(calls), 'Edit per payment max')))
    const prompt = last(calls)
    expect(text(prompt)).toBe(
      'New per payment max for <code>research-agent</code>, in dollars (like 2.50):',
    )
    expect(prompt?.payload['reply_markup']).toEqual({ force_reply: true })

    await bot.handleUpdate(say(OWNER, '-1', prompt?.messageId))
    expect(text(last(calls))).toContain('Send an amount in dollars')
    await bot.handleUpdate(say(OWNER, '$0.75', prompt?.messageId))
    expect(admin.putPolicy).toHaveBeenCalledWith(policy({ perTxMax: '750000' }))

    // The prompt is answered: a later reply to it is an ordinary message.
    await bot.handleUpdate(say(OWNER, '9', prompt?.messageId))
    expect(admin.putPolicy).toHaveBeenCalledTimes(1)
  })

  it('answers for an unknown agent', async () => {
    const { bot, calls } = setup()
    await bot.handleUpdate(command(OWNER, '/policy ghost'))
    expect(text(last(calls))).toBe('No agent <code>ghost</code>.')
  })
})

describe('/allow and /deny', () => {
  it('adds a lowercased hostname once and removes it', async () => {
    const { bot, admin } = setup()
    await bot.handleUpdate(command(OWNER, '/allow research-agent Data.Example.org'))
    expect(admin.putPolicy).toHaveBeenLastCalledWith(
      policy({ allowedDomains: ['api.example.com', 'data.example.org'] }),
    )
    await bot.handleUpdate(command(OWNER, '/allow research-agent data.example.org'))
    expect(admin.putPolicy).toHaveBeenLastCalledWith(
      policy({ allowedDomains: ['api.example.com', 'data.example.org'] }),
    )
    await bot.handleUpdate(command(OWNER, '/deny research-agent api.example.com'))
    expect(admin.putPolicy).toHaveBeenLastCalledWith(
      policy({ allowedDomains: ['data.example.org'] }),
    )
  })

  it('refuses what is not a hostname', async () => {
    const { bot, admin, calls } = setup()
    for (const bad of ['https://api.example.com', 'localhost', '-x.example.com', 'a..b']) {
      await bot.handleUpdate(command(OWNER, `/allow research-agent ${bad}`))
    }
    expect(admin.putPolicy).not.toHaveBeenCalled()
    expect(text(last(calls))).toContain('Usage: /allow')
  })
})

describe('/mode', () => {
  it('goes to shadow at once', async () => {
    const admin = fakeAdmin()
    await admin.putPolicy(policy({ mode: 'live' }))
    const { bot } = setup({ admin })
    await bot.handleUpdate(command(OWNER, '/mode research-agent shadow'))
    expect(admin.putPolicy).toHaveBeenLastCalledWith(policy({ mode: 'shadow' }))
  })

  it('goes live only from the confirm, showing what shadow would have spent', async () => {
    const budget = vi.fn(async () => ({
      ...BUDGET,
      shadow: { since: NOW.toISOString(), total: '3500000', count: 1 },
    }))
    const { bot, admin, calls } = setup({ guard: fakeGuard({ budget }) })
    await bot.handleUpdate(command(OWNER, '/mode research-agent live'))
    const ask = last(calls)
    expect(text(ask)).toBe(
      '<b>Go live</b> with <code>research-agent</code>? It starts signing real payments.\n' +
        'In shadow mode it would have spent $3.50 in 1 payment since 2026-11-03 12:00:00 UTC.',
    )
    expect(admin.putPolicy).not.toHaveBeenCalled()
    await bot.handleUpdate(press(OWNER, buttonData(ask, 'Go live')))
    expect(admin.putPolicy).toHaveBeenCalledWith(policy({ mode: 'live' }))
  })

  it('says so when guard-core reports no shadowed payment', async () => {
    const { bot, calls } = setup()
    await bot.handleUpdate(command(OWNER, '/mode research-agent live'))
    expect(text(last(calls))).toContain('guard-core reports no shadowed payment for it.')
  })
})

describe('/doctor', () => {
  it('gives one line per check, with the fix under each warning or failure', async () => {
    const doctor = vi.fn(async () => [
      { id: 'db', status: 'ok' as const, message: 'Database writable' },
      {
        id: 'gas',
        status: 'warn' as const,
        message: 'Hot wallet gas is low <0.01 SOL>',
        fix: 'Send 0.05 SOL to the hot wallet',
      },
      { id: 'bot', status: 'fail' as const, message: 'Bot unreachable', fix: 'Check BOT_URL' },
    ])
    const { bot, calls } = setup({ admin: fakeAdmin({ doctor }) })
    await bot.handleUpdate(command(OWNER, '/doctor'))
    expect(text(last(calls))).toBe(
      [
        '<b>Doctor</b>',
        '✅ Database writable',
        '⚠️ Hot wallet gas is low &lt;0.01 SOL&gt;',
        '    Fix: Send 0.05 SOL to the hot wallet',
        '❌ Bot unreachable',
        '    Fix: Check BOT_URL',
      ].join('\n'),
    )
  })

  it('says guard-core did not answer', async () => {
    const doctor = vi.fn().mockRejectedValue(new Error('down'))
    const { bot, calls } = setup({ admin: fakeAdmin({ doctor }) })
    await bot.handleUpdate(command(OWNER, '/doctor'))
    expect(text(last(calls))).toBe('guard-core did not answer. Nothing changed: try again.')
  })
})

describe('shadow graduation', () => {
  const shadowSince = (since: Date) =>
    vi.fn(async () => ({
      ...BUDGET,
      shadow: { since: since.toISOString(), total: '2500000', count: 2 },
    }))

  it('offers once, three days after the first shadowed payment, and opens the live confirm', async () => {
    let now = new Date(NOW.getTime() + 3 * 86_400_000 - 1)
    const budget = shadowSince(NOW)
    const { bot, owner, admin, calls } = setup({ now: () => now, guard: fakeGuard({ budget }) })
    await owner.sweep()
    expect(sent(calls, 'sendMessage')).toHaveLength(0)

    // guard-core is asked at most every five minutes.
    now = new Date(NOW.getTime() + 3 * 86_400_000)
    await owner.sweep()
    expect(sent(calls, 'sendMessage')).toHaveLength(0)
    now = new Date(now.getTime() + 5 * 60_000)
    await owner.sweep()
    now = new Date(now.getTime() + 5 * 60_000)
    await owner.sweep()
    const offers = sent(calls, 'sendMessage')
    expect(offers.map((call) => call.payload['chat_id'])).toEqual([OWNER.id, OTHER_OWNER.id])
    expect(text(offers[0])).toBe(
      'Your agent <code>research-agent</code> would have spent $2.50 in 2 payments. Go live?',
    )

    await bot.handleUpdate(press(OWNER, buttonData(offers[0], 'Go live…')))
    expect(text(last(calls))).toMatch(/^<b>Go live<\/b> with <code>research-agent<\/code>/)
    expect(admin.putPolicy).not.toHaveBeenCalled()
  })

  it('skips an agent that is live or has no shadow total', async () => {
    const listAgents = vi.fn(async () => [
      { agentId: 'live-agent', paused: false, mode: 'live' as const },
      { agentId: 'quiet-agent', paused: false, mode: 'shadow' as const },
    ])
    const budget = vi.fn(async () => BUDGET)
    const later = new Date(NOW.getTime() + 30 * 86_400_000)
    const { owner, calls } = setup({
      now: () => later,
      admin: fakeAdmin({ listAgents }),
      guard: fakeGuard({ budget }),
    })
    await owner.sweep()
    expect(budget).toHaveBeenCalledWith('quiet-agent')
    expect(budget).not.toHaveBeenCalledWith('live-agent')
    expect(calls).toHaveLength(0)
  })
})

describe('/passkey enrol', () => {
  it('sends a one-time link to the enrol page and deletes it after 10 minutes', async () => {
    let now = NOW
    const lines: string[] = []
    const log = pino(
      { level: 'trace' },
      new Writable({
        write(chunk, _encoding, done) {
          lines.push(String(chunk))
          done()
        },
      }),
    )
    const { bot, owner, admin, calls } = setup({
      now: () => now,
      log,
      guardPublicUrl: 'https://guard.example/',
    })
    await bot.handleUpdate(command(OWNER, '/passkey enrol'))
    expect(admin.enrolCode).toHaveBeenCalled()
    const link = last(calls)
    expect(text(link)).toBe(
      'Open this on the device that holds your passkey, once, before 2026-11-03 12:10:00 UTC:\n' +
        'https://guard.example/owner/enrol#code=enrol-code-123456\n' +
        'A code adds your first passkey only; a later one also needs a passkey you already have.\n' +
        'This message deletes itself in 10 minutes.',
    )
    expect(lines.join('')).not.toContain('enrol-code-123456')

    now = new Date(NOW.getTime() + 600_000 - 1)
    await owner.sweep()
    expect(sent(calls, 'deleteMessage')).toHaveLength(0)
    now = new Date(NOW.getTime() + 600_000)
    await owner.sweep()
    expect(sent(calls, 'deleteMessage').map((call) => call.payload['message_id'])).toEqual([
      link?.messageId,
    ])
  })

  it('says it cannot be done from Telegram without GUARD_PUBLIC_URL', async () => {
    const { bot, admin, calls } = setup()
    await bot.handleUpdate(command(OWNER, '/passkey enrol'))
    expect(admin.enrolCode).not.toHaveBeenCalled()
    expect(text(last(calls))).toContain('cannot be enrolled from Telegram here')
  })

  it('shows its usage for anything else', async () => {
    const { bot, calls } = setup({ guardPublicUrl: 'https://guard.example' })
    await bot.handleUpdate(command(OWNER, '/passkey'))
    expect(text(last(calls))).toBe('Usage: /passkey enrol')
  })
})
