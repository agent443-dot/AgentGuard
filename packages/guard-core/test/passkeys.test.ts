import { generateKeyPairSync } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApprovalRequest } from '@agentguard/shared'
import {
  ADMIN_TOKEN,
  CHAIN,
  harness,
  MERCHANT,
  MINT,
  NOW,
  PASSKEY_RP,
  type Harness,
} from './harness.js'
import { softAuthenticator } from './webauthn.js'

const admin = (h: Harness, url: string, payload: object = {}) =>
  h.app.inject({
    method: 'POST',
    url,
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    payload,
  })

const pay = (h: Harness, amount: string) =>
  h.agent('POST', '/v1/agent/transfer', {
    agentId: 'agent-1',
    chain: CHAIN,
    token: MINT,
    amount,
    recipient: MERCHANT,
    reason: 'pay <b>the</b> invoice',
  })

async function enrol(h: Harness) {
  const device = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin)
  const options = (await admin(h, '/v1/admin/passkeys/options')).json()
  const res = await admin(h, '/v1/admin/passkeys', { response: device.register(options.challenge) })
  expect(res.json()).toEqual({ enrolled: true })
  return device
}

/** Opens the owner's page and reads the challenge it was given. */
async function openPage(h: Harness, intentId: string) {
  const res = await h.app.inject({ method: 'GET', url: `/owner/approve/${intentId}` })
  const options = /<script id="options"[^>]*>(.*?)<\/script>/s.exec(res.body)?.[1]
  return { res, challenge: options === undefined ? '' : (JSON.parse(options).challenge as string) }
}

const approve = (h: Harness, intentId: string, assertion: object) =>
  h.app.inject({ method: 'POST', url: '/v1/owner/approve', payload: { intentId, assertion } })

let h: Harness
beforeEach(async () => {
  h = await harness({ passkeyAbove: '3000000', policy: { perTxMax: '9000000' } })
})

describe('passkey approvals', () => {
  it('marks a request at or above PASSKEY_ABOVE as passkey-only, and one below as not', async () => {
    await pay(h, '3000000')
    await pay(h, '2500000')
    const sent = vi
      .mocked(h.bot.requestApproval)
      .mock.calls.map((c) => (c[0] as ApprovalRequest).passkey)
    expect(sent).toEqual([true, false])
  })

  it('lets Telegram reject such an intent, never approve it', async () => {
    const one = (await pay(h, '3000000')).json()
    const tap = await h.asBot({ intentId: one.intentId, decision: 'approve', telegramUserId: '1' })
    expect(tap.statusCode).toBe(403)
    expect(tap.json()).toEqual({ error: 'passkey_required' })
    const no = await h.asBot({ intentId: one.intentId, decision: 'reject', telegramUserId: '1' })
    expect(no.json().status).toBe('rejected')
  })

  it('approves and sends it with an enrolled passkey, and the receipt says so', async () => {
    h = await harness({
      passkeyAbove: '3000000',
      policy: { perTxMax: '9000000' },
      receiptKey: generateKeyPairSync('ed25519').privateKey,
    })
    const device = await enrol(h)
    const one = (await pay(h, '3000000')).json()
    const { res, challenge } = await openPage(h, one.intentId)
    expect(res.headers['content-security-policy']).toContain("script-src 'self'")
    const done = await approve(h, one.intentId, device.assert(challenge))
    expect(done.statusCode).toBe(200)
    expect(done.json().status).toBe('executed')
    expect(h.auditEvents(one.intentId)).toContain('owner_decision')
    const receipt = await h.agent('GET', `/v1/agent/intents/${one.intentId}/receipt`)
    expect(receipt.json().approvedBy).toBe('passkey')
  })

  it('takes each challenge once, so an assertion cannot be replayed', async () => {
    const device = await enrol(h)
    const one = (await pay(h, '3000000')).json()
    const { challenge } = await openPage(h, one.intentId)
    const assertion = device.assert(challenge)
    const second = (await pay(h, '3000000')).json()
    await openPage(h, second.intentId)
    // The first intent's challenge, presented for the second intent.
    expect((await approve(h, second.intentId, assertion)).statusCode).toBe(401)
    expect((await approve(h, one.intentId, assertion)).statusCode).toBe(200)
    expect((await approve(h, one.intentId, assertion)).statusCode).toBe(404)
  })

  it('approves once when the same assertion is sent several times at once', async () => {
    const device = await enrol(h)
    const one = (await pay(h, '3000000')).json()
    const { challenge } = await openPage(h, one.intentId)
    const assertion = device.assert(challenge)
    const sends = await Promise.all([0, 1, 2].map(() => approve(h, one.intentId, assertion)))
    expect(sends.filter((r) => r.statusCode === 200)).toHaveLength(1)
  })

  it('refuses an assertion made for another origin, as a phishing page would get', async () => {
    const device = await enrol(h)
    const one = (await pay(h, '3000000')).json()
    const { challenge } = await openPage(h, one.intentId)
    const phished = device.assert(challenge, 'https://guard-example.evil')
    expect((await approve(h, one.intentId, phished)).statusCode).toBe(401)
    expect(h.auditEvents(one.intentId)).toContain('passkey_refused')
  })

  it('refuses a passkey that was never enrolled', async () => {
    await enrol(h)
    const stranger = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin)
    const one = (await pay(h, '3000000')).json()
    const { challenge } = await openPage(h, one.intentId)
    expect((await approve(h, one.intentId, stranger.assert(challenge))).statusCode).toBe(401)
  })

  it('has nothing to approve for an intent below the amount, or no longer waiting', async () => {
    await enrol(h)
    const small = (await pay(h, '2500000')).json()
    expect((await openPage(h, small.intentId)).res.statusCode).toBe(404)
    const big = (await pay(h, '3000000')).json()
    expect((await openPage(h, big.intentId)).res.statusCode).toBe(200)
    h.clock.now = new Date(NOW.getTime() + 11 * 60_000)
    expect((await openPage(h, big.intentId)).res.statusCode).toBe(404)
  })

  it("shows the agent's text as text, never as markup", async () => {
    await enrol(h)
    const one = (await pay(h, '3000000')).json()
    const { res } = await openPage(h, one.intentId)
    expect(res.body).toContain('pay &#60;b&#62;the&#60;/b&#62; invoice')
    expect(res.body).not.toContain('<b>the</b>')
  })

  it('shows the amount in dollars with the chain symbol', async () => {
    await enrol(h)
    const one = (await pay(h, '3000000')).json()
    const { res } = await openPage(h, one.intentId)
    expect(res.body).toContain('3.00 USDC')
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['strict-transport-security']).toContain('includeSubDomains')
  })

  it('reuses the challenge still out when the page is opened again', async () => {
    const device = await enrol(h)
    const one = (await pay(h, '3000000')).json()
    const first = await openPage(h, one.intentId)
    const second = await openPage(h, one.intentId)
    expect(second.challenge).toBe(first.challenge)
    expect((await approve(h, one.intentId, device.assert(first.challenge))).statusCode).toBe(200)
  })

  it('keeps the challenge when an answer to it fails verification', async () => {
    const device = await enrol(h)
    const stranger = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin)
    const one = (await pay(h, '3000000')).json()
    const { challenge } = await openPage(h, one.intentId)
    expect((await approve(h, one.intentId, stranger.assert(challenge))).statusCode).toBe(401)
    expect(
      (await approve(h, one.intentId, device.assert(challenge, 'https://x.evil'))).statusCode,
    ).toBe(401)
    expect((await approve(h, one.intentId, device.assert(challenge))).statusCode).toBe(200)
  })

  it('adds only the first passkey through the admin routes, and lists them', async () => {
    const device = await enrol(h)
    expect(h.bot.alert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'passkey_enrolled', detail: device.id.slice(0, 8) }),
    )
    const other = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin)
    const options = (await admin(h, '/v1/admin/passkeys/options')).json()
    const second = await admin(h, '/v1/admin/passkeys', {
      response: other.register(options.challenge),
    })
    expect(second.statusCode).toBe(409)
    const one = (await pay(h, '3000000')).json()
    const { challenge } = await openPage(h, one.intentId)
    await approve(h, one.intentId, device.assert(challenge))
    const list = await h.app.inject({
      method: 'GET',
      url: '/v1/admin/passkeys',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    })
    expect(list.json()).toEqual({
      passkeys: [{ id: device.id, createdAt: NOW.toISOString(), lastUsedAt: NOW.toISOString() }],
    })
    expect((await h.app.inject({ method: 'GET', url: '/v1/admin/passkeys' })).statusCode).toBe(401)
  })

  it('serves the page script with no inline code', async () => {
    const js = await h.app.inject({ method: 'GET', url: '/owner/approve.js' })
    expect(js.headers['content-type']).toContain('text/javascript')
    const one = (await pay(h, '3000000')).json()
    const { res } = await openPage(h, one.intentId)
    expect(res.body).not.toMatch(/<script>(?!<)/)
  })
})

describe('without PASSKEY_ABOVE', () => {
  it('leaves Telegram approvals as they were', async () => {
    const plain = await harness()
    const one = (
      await plain.agent('POST', '/v1/agent/transfer', {
        agentId: 'agent-1',
        chain: CHAIN,
        token: MINT,
        amount: '3000000',
        recipient: MERCHANT,
        reason: 'pay',
      })
    ).json()
    const tap = await plain.asBot({
      intentId: one.intentId,
      decision: 'approve',
      telegramUserId: '1',
    })
    expect(tap.json().status).toBe('executed')
    expect(
      (await plain.app.inject({ method: 'GET', url: `/owner/approve/${one.intentId}` })).statusCode,
    ).toBe(404)
  })
})
