import { describe, expect, it, vi } from 'vitest'
import { buildServer } from '../src/http/server.js'
import { sign } from '../src/domain/signature.js'
import {
  approval,
  fakeGuard,
  INTENT_ID,
  intent,
  NOW,
  OTHER_OWNER,
  OWNER,
  press,
  RECIPIENT,
  SECRET,
  sent,
  setup,
  silent,
  STRANGER,
} from './support.js'

async function harness(options: Parameters<typeof setup>[0] & { perMinute?: number } = {}) {
  const parts = setup(options)
  const app = await buildServer({
    rateLimitPerMinute: options.perMinute,
    secret: SECRET,
    handlers: {
      approvalRequest: (request) => parts.desk.post(request),
      intentEvent: (event) => parts.desk.event(event),
      alert: (event) => parts.desk.alert(event),
    },
    logger: silent,
  })
  function deliver(path: string, body: unknown, signature?: string) {
    const raw = JSON.stringify(body)
    return app.inject({
      method: 'POST',
      url: path,
      headers: {
        'content-type': 'application/json',
        'x-guard-signature': signature ?? sign(raw, SECRET),
      },
      payload: raw,
    })
  }
  return { ...parts, app, deliver }
}

describe('approval flow', () => {
  it('takes a signed request to both owners and settles it on one press', async () => {
    const { bot, guard, calls, deliver } = await harness()

    const response = await deliver('/hooks/approval-request', approval())
    expect(response.statusCode).toBe(200)

    const posted = sent(calls, 'sendMessage')
    expect(posted.map((call) => call.payload['chat_id'])).toEqual([OWNER.id, OTHER_OWNER.id])
    expect(posted[0]?.payload['parse_mode']).toBe('HTML')
    expect(posted[0]?.payload['text']).toContain('agent says:')
    expect(JSON.stringify(posted[0]?.payload['reply_markup'])).toContain(`approve:${INTENT_ID}`)

    await bot.handleUpdate(press(OWNER, `approve:${INTENT_ID}`))

    expect(guard.decide).toHaveBeenCalledWith(INTENT_ID, 'approve', OWNER.id)
    const edits = sent(calls, 'editMessageText')
    expect(edits).toHaveLength(2)
    for (const edit of edits) {
      expect(edit.payload['text']).toContain('<b>Approved</b> by @ana')
      expect(edit.payload['text']).toContain(RECIPIENT)
      expect(edit.payload['reply_markup']).toBeUndefined()
    }
    expect(sent(calls, 'answerCallbackQuery')[0]?.payload['text']).toBe('Approved')
  })

  it('edits once when the second owner presses too', async () => {
    const decide = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, intent: intent({ status: 'rejected' }) })
      .mockResolvedValueOnce({ ok: false, reason: 'already_decided' })
    const { bot, calls, deliver } = await harness({ guard: fakeGuard({ decide }) })
    await deliver('/hooks/approval-request', approval())

    await bot.handleUpdate(press(OTHER_OWNER, `reject:${INTENT_ID}`, 2))
    await bot.handleUpdate(press(OWNER, `approve:${INTENT_ID}`, 1))

    expect(sent(calls, 'editMessageText')).toHaveLength(2)
    expect(sent(calls, 'editMessageText')[0]?.payload['text']).toContain('<b>Rejected</b> by Bo')
    expect(sent(calls, 'answerCallbackQuery')[1]?.payload['text']).toBe('Already decided.')
  })

  it('reports a press that guard-core calls expired, and drops the buttons', async () => {
    const decide = vi.fn().mockResolvedValue({ ok: false, reason: 'expired' })
    const { bot, calls, deliver } = await harness({ guard: fakeGuard({ decide }) })
    await deliver('/hooks/approval-request', approval())

    await bot.handleUpdate(press(OWNER, `approve:${INTENT_ID}`))

    expect(sent(calls, 'editMessageText')[0]?.payload['text']).toContain('<b>Expired</b>')
    expect(sent(calls, 'answerCallbackQuery')[0]?.payload['text']).toMatch(/expired/)
  })

  it('keeps the buttons when guard-core does not answer', async () => {
    const decide = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const { bot, calls, deliver } = await harness({ guard: fakeGuard({ decide }) })
    await deliver('/hooks/approval-request', approval())

    await bot.handleUpdate(press(OWNER, `approve:${INTENT_ID}`))

    expect(sent(calls, 'editMessageText')).toHaveLength(0)
    expect(sent(calls, 'answerCallbackQuery')[0]?.payload['text']).toContain('try again')
  })

  it('settles a message from before a restart from its own text', async () => {
    const decide = vi.fn().mockResolvedValue({ ok: false, reason: 'not_found' })
    const { bot, calls } = await harness({ guard: fakeGuard({ decide }) })

    await bot.handleUpdate(press(OWNER, `reject:${INTENT_ID}`, 7))

    const [edit] = sent(calls, 'editMessageText')
    expect(edit?.payload['message_id']).toBe(7)
    expect(edit?.payload['text']).toContain('Unknown intent')
  })

  it('expires unanswered requests on the sweep', async () => {
    let now = NOW
    const { desk, calls, deliver } = await harness({ now: () => now })
    await deliver('/hooks/approval-request', approval())

    now = new Date(NOW.getTime() + 10 * 60_000)
    await desk.expire()

    const edits = sent(calls, 'editMessageText')
    expect(edits).toHaveLength(2)
    expect(edits[0]?.payload['text']).toContain('<b>Expired</b>')
  })

  it('shows the full recipient on tap', async () => {
    const { bot, calls, deliver } = await harness()
    await deliver('/hooks/approval-request', approval())

    await bot.handleUpdate(press(OWNER, `recipient:${INTENT_ID}`))
    await bot.handleUpdate(press(OWNER, 'recipient:00000000-0000-0000-0000-000000000000'))

    const [full, gone] = sent(calls, 'answerCallbackQuery')
    expect(full?.payload).toMatchObject({ text: RECIPIENT, show_alert: true })
    expect(gone?.payload['text']).toContain('no longer held')
  })

  it('ignores everyone who is not an owner, without a word', async () => {
    const { bot, guard, calls, deliver } = await harness()
    await deliver('/hooks/approval-request', approval())
    const before = calls.length

    await bot.handleUpdate(press(STRANGER, `approve:${INTENT_ID}`))

    expect(guard.decide).not.toHaveBeenCalled()
    expect(calls).toHaveLength(before)
  })
})

describe('POST /hooks/approval-request', () => {
  it('refuses a bad signature before reading the body', async () => {
    const { calls, deliver } = await harness()
    const response = await deliver('/hooks/approval-request', approval(), sign('other', SECRET))
    expect(response.statusCode).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('drops a request without a usable signature before reading its body', async () => {
    const { app, calls } = await harness()
    for (const signature of [undefined, 'nothex', 'ab'.repeat(31)]) {
      const response = await app.inject({
        method: 'POST',
        url: '/hooks/approval-request',
        headers: {
          'content-type': 'application/json',
          ...(signature === undefined ? {} : { 'x-guard-signature': signature }),
        },
        // Past the 64 KiB body limit: a 401 rather than a 413 shows the body was never read.
        payload: 'x'.repeat(100 * 1024),
      })
      expect(response.statusCode).toBe(401)
    }
    expect(calls).toHaveLength(0)
  })

  it('rate-limits the hooks per client', async () => {
    const { deliver } = await harness({ perMinute: 2 })
    expect((await deliver('/hooks/approval-request', approval())).statusCode).toBe(200)
    expect((await deliver('/hooks/approval-request', approval())).statusCode).toBe(409)
    expect((await deliver('/hooks/approval-request', approval())).statusCode).toBe(429)
  })

  it('refuses a missing signature', async () => {
    const { app } = await harness()
    const response = await app.inject({
      method: 'POST',
      url: '/hooks/approval-request',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(approval()),
    })
    expect(response.statusCode).toBe(401)
  })

  it('refuses a replay of the same signed request', async () => {
    const { calls, deliver } = await harness()
    await deliver('/hooks/approval-request', approval())
    const replay = await deliver('/hooks/approval-request', approval())
    expect(replay.statusCode).toBe(409)
    expect(sent(calls, 'sendMessage')).toHaveLength(2)
  })

  it('refuses a stale request', async () => {
    const { calls, deliver } = await harness()
    const old = approval({ expiresAt: new Date(NOW.getTime() - 1).toISOString() })
    expect((await deliver('/hooks/approval-request', old)).statusCode).toBe(410)
    expect(calls).toHaveLength(0)
  })

  it('refuses signed bodies that are not approval requests', async () => {
    const { deliver, app } = await harness()
    expect((await deliver('/hooks/approval-request', { hello: 1 })).statusCode).toBe(400)
    const raw = 'not json'
    const response = await app.inject({
      method: 'POST',
      url: '/hooks/approval-request',
      headers: { 'content-type': 'application/json', 'x-guard-signature': sign(raw, SECRET) },
      payload: raw,
    })
    expect(response.statusCode).toBe(400)
  })

  it('answers 502 when no owner could be messaged, so the request can be sent again', async () => {
    const { deliver } = await harness({ fail: (call) => call.method === 'sendMessage' })
    expect((await deliver('/hooks/approval-request', approval())).statusCode).toBe(502)
    expect((await deliver('/hooks/approval-request', approval())).statusCode).toBe(502)
  })

  it('still counts as delivered when one owner blocked the bot', async () => {
    const { deliver } = await harness({ fail: (call) => call.payload['chat_id'] === OWNER.id })
    expect((await deliver('/hooks/approval-request', approval())).statusCode).toBe(200)
  })
})

describe('POST /hooks/intent-event', () => {
  const event = (overrides: Parameters<typeof intent>[0]) => ({
    intent: intent(overrides),
    sentAt: NOW.toISOString(),
  })

  it('tells both owners about a large executed payment, once', async () => {
    const { calls, deliver } = await harness()
    const executed = event({ status: 'executed', txId: '5h3k' })
    expect((await deliver('/hooks/intent-event', executed)).statusCode).toBe(200)
    expect((await deliver('/hooks/intent-event', executed)).statusCode).toBe(409)
    const messages = sent(calls, 'sendMessage')
    expect(messages).toHaveLength(2)
    expect(messages[0]?.payload['text']).toContain('Payment executed')
    expect(messages[0]?.payload['text']).toContain('5h3k')
  })

  it('raises an alarm on an attack code', async () => {
    const { calls, deliver } = await harness()
    await deliver(
      '/hooks/intent-event',
      event({ status: 'rejected', rejectReasons: ['PERMIT_DETECTED'] }),
    )
    expect(sent(calls, 'sendMessage')[0]?.payload['text']).toContain('Possible attack blocked')
  })

  it('does not let a loop of malicious payments flood the owners', async () => {
    let now = NOW
    const { desk, calls, deliver } = await harness({ now: () => now })
    for (let i = 0; i < 50; i++) {
      const id = `4b8f6c0e-2a8e-4f7e-9a51-${String(i).padStart(12, '0')}`
      const response = await deliver('/hooks/intent-event', {
        intent: intent({ id, status: 'rejected', rejectReasons: ['UNKNOWN_PROGRAM_DETECTED'] }),
        sentAt: now.toISOString(),
      })
      expect(response.statusCode).toBe(200)
    }
    expect(sent(calls, 'sendMessage')).toHaveLength(2)

    now = new Date(NOW.getTime() + 5 * 60_000)
    await desk.flushAlerts()

    const messages = sent(calls, 'sendMessage')
    expect(messages).toHaveLength(4)
    expect(messages[3]?.payload['text']).toContain('49 more <code>UNKNOWN_PROGRAM_DETECTED</code>')
  })

  it('accepts a refused x402 offer whatever the 402 server put in it', async () => {
    const { calls, deliver } = await harness()
    const refused = (overrides: Record<string, unknown>) => ({
      intent: { ...intent({ status: 'rejected', rejectReasons: ['INVALID_402'] }), ...overrides },
      sentAt: NOW.toISOString(),
    })

    const empty = refused({ chain: '', token: '', recipient: '', amount: '0' })
    expect((await deliver('/hooks/intent-event', empty)).statusCode).toBe(200)
    const junk = refused({
      id: '4b8f6c0e-2a8e-4f7e-9a51-000000000001',
      chain: { evil: true },
      amount: '1.5e30',
      recipient: `<b>${'x'.repeat(500)}`,
      rejectReasons: ['APPROVAL_DETECTED'],
    })
    expect((await deliver('/hooks/intent-event', junk)).statusCode).toBe(200)

    const [alert] = sent(calls, 'sendMessage').map((call) => String(call.payload['text']))
    expect(alert).toContain('Chain: (not given)')
    expect(alert).toContain('&lt;b&gt;xxx')
    expect(alert).not.toContain('x'.repeat(200))
  })

  it('keeps the strict shape for a payment that settled', async () => {
    const { calls, deliver } = await harness()
    const executed = {
      intent: intent({ status: 'executed', amount: '1.5' }),
      sentAt: NOW.toISOString(),
    }
    expect((await deliver('/hooks/intent-event', executed)).statusCode).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('stays quiet on small payments and refuses old events', async () => {
    const { calls, deliver } = await harness()
    await deliver('/hooks/intent-event', event({ status: 'executed', amount: '10' }))
    const old = { ...event({ status: 'executed' }), sentAt: '2026-11-03T11:00:00.000Z' }
    expect((await deliver('/hooks/intent-event', old)).statusCode).toBe(410)
    expect(calls).toHaveLength(0)
  })
})

describe('breaker alerts', () => {
  const alert = (overrides: Record<string, unknown> = {}) => ({
    kind: 'breaker_tripped',
    agentId: 'research-agent',
    detail: '11 payments in one minute <b>',
    sentAt: NOW.toISOString(),
    ...overrides,
  })

  it('tells every owner the agent is paused and how to resume it', async () => {
    const { calls, deliver } = await harness()
    const response = await deliver('/hooks/alert', alert())
    expect(response.statusCode).toBe(200)
    const posted = sent(calls, 'sendMessage')
    expect(posted.map((call) => call.payload['chat_id'])).toEqual([OWNER.id, OTHER_OWNER.id])
    expect(posted[0]?.payload['text']).toBe(
      '<b>Circuit breaker tripped</b> for <code>research-agent</code>: paused. ' +
        '/resume <code>research-agent</code> when you have looked.\n' +
        'guard-core says: <i>11 payments in one minute &lt;b&gt;</i>',
    )
  })

  it('checks the signature, the age and replays like the other hooks', async () => {
    const { calls, deliver } = await harness()
    expect((await deliver('/hooks/alert', alert(), 'sha256=' + '0'.repeat(64))).statusCode).toBe(
      401,
    )
    const old = new Date(NOW.getTime() - 6 * 60_000).toISOString()
    expect((await deliver('/hooks/alert', alert({ sentAt: old }))).statusCode).toBe(410)
    expect((await deliver('/hooks/alert', alert())).statusCode).toBe(200)
    expect((await deliver('/hooks/alert', alert())).statusCode).toBe(409)
    expect((await deliver('/hooks/alert', alert({ kind: 'other' }))).statusCode).toBe(400)
    expect(sent(calls, 'sendMessage')).toHaveLength(2)
  })

  it('has no alert route when the embedding gives no handler', async () => {
    const { desk } = setup()
    const app = await buildServer({
      secret: SECRET,
      handlers: {
        approvalRequest: (request) => desk.post(request),
        intentEvent: (event) => desk.event(event),
      },
      logger: silent,
    })
    const raw = JSON.stringify(alert())
    const response = await app.inject({
      method: 'POST',
      url: '/hooks/alert',
      headers: { 'content-type': 'application/json', 'x-guard-signature': sign(raw, SECRET) },
      payload: raw,
    })
    expect(response.statusCode).toBe(404)
  })

  it('reports undelivered when no owner could be reached', async () => {
    const { deliver } = await harness({ fail: () => true })
    expect((await deliver('/hooks/alert', alert())).statusCode).toBe(502)
  })
})

describe('shadow mode events', () => {
  it('accepts a shadowed payment without messaging anyone', async () => {
    const { calls, deliver } = await harness()
    const event = {
      intent: intent({ status: 'shadowed' as never, amount: '999000000' }),
      sentAt: NOW.toISOString(),
    }
    expect((await deliver('/hooks/intent-event', event)).statusCode).toBe(200)
    expect((await deliver('/hooks/intent-event', event)).statusCode).toBe(409)
    expect(calls).toHaveLength(0)
  })
})

describe('approval flags', () => {
  it('puts the reason a payment is here above the request', async () => {
    const { calls, deliver } = await harness()
    await deliver('/hooks/approval-request', {
      ...approval(),
      flags: ['RECIPIENT_CHANGED', 'PRICE_JUMP'],
    })
    const text = String(sent(calls, 'sendMessage')[0]?.payload['text'])
    expect(text.split('\n').slice(0, 3)).toEqual([
      '⚠️ <b>This API asks to pay a different address than last time.</b>',
      '⚠️ <b>Price jump: this API asks for much more than its last payment.</b>',
      '<b>Approval needed</b>',
    ])
  })

  it('reads a request without flags as having none, and refuses an unknown one', async () => {
    const { calls, deliver } = await harness()
    await deliver('/hooks/approval-request', approval())
    expect(String(sent(calls, 'sendMessage')[0]?.payload['text'])).toMatch(/^<b>Approval needed/)
    const other = approval({ id: '5b8f6c0e-2a8e-4f7e-9a51-6f0c3d1a2b77' })
    const response = await deliver('/hooks/approval-request', { ...other, flags: ['ODD'] })
    expect(response.statusCode).toBe(400)
  })
})
