import { Script } from 'node:vm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { countPasskeys, pruneExpired } from '../src/db/passkeys.js'
import { schema } from '../src/db/client.js'
import { ADMIN_TOKEN, harness, NOW, PASSKEY_RP, type Harness } from './harness.js'
import { softAuthenticator } from './webauthn.js'

const post = (h: Harness, url: string, payload: object) =>
  h.app.inject({ method: 'POST', url, payload })

const issue = async (h: Harness) =>
  (
    await h.app.inject({
      method: 'POST',
      url: '/v1/admin/passkeys/code',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    })
  ).json() as { code: string; expiresAt: string }

/** Enrols a device with a fresh code, vouched for by `voucher` when a passkey already exists. */
async function enrolWithCode(
  h: Harness,
  device = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin),
  voucher?: ReturnType<typeof softAuthenticator>,
) {
  const { code } = await issue(h)
  const options = (await post(h, '/v1/owner/passkeys/options', { code })).json()
  const res = await post(h, '/v1/owner/passkeys', {
    code,
    response: device.register(options.registration.challenge),
    ...(voucher === undefined ? {} : { assertion: voucher.assert(options.stepUp.challenge) }),
  })
  return { res, code, options, device }
}

let h: Harness
beforeEach(async () => {
  h = await harness()
})

describe('enrolling a passkey with a one-time code', () => {
  it('issues a ten-minute code, keeping only its hash, and audits it', async () => {
    const { code, expiresAt } = await issue(h)
    expect(code).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(expiresAt).toBe(new Date(NOW.getTime() + 10 * 60_000).toISOString())
    expect(JSON.stringify(h.db.select().from(schema.enrolCodes).all())).not.toContain(code)
    expect(h.auditEvents()).toContain('passkey_code_issued')
  })

  it('enrols the first passkey with the code alone, audits it and alerts the owner', async () => {
    const { res, options, device } = await enrolWithCode(h)
    expect(options.stepUp).toBeUndefined()
    expect(res.json()).toEqual({ enrolled: true })
    expect(countPasskeys(h.db)).toBe(1)
    expect(h.auditEvents()).toContain('passkey_enrolled')
    expect(h.bot.alert).toHaveBeenCalledWith({
      kind: 'passkey_enrolled',
      detail: device.id.slice(0, 8),
      sentAt: NOW.toISOString(),
    })
  })

  it('takes each code once', async () => {
    const { code, options, device } = await enrolWithCode(h)
    const again = await post(h, '/v1/owner/passkeys', {
      code,
      response: device.register(options.registration.challenge),
    })
    expect(again.statusCode).toBe(401)
    expect(countPasskeys(h.db)).toBe(1)
  })

  it('needs an enrolled passkey to vouch for a second one', async () => {
    await enrolWithCode(h)
    const intruder = await enrolWithCode(h)
    expect(intruder.options.stepUp.challenge).toEqual(expect.any(String))
    expect(intruder.res.statusCode).toBe(401)
    expect(intruder.res.json()).toEqual({ error: 'step_up_required' })
    expect(h.auditEvents()).toContain('passkey_step_up_refused')
    expect(countPasskeys(h.db)).toBe(1)
  })

  it('refuses a step-up signed by a passkey that is not enrolled', async () => {
    await enrolWithCode(h)
    const stranger = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin)
    const { res } = await enrolWithCode(h, undefined, stranger)
    expect(res.statusCode).toBe(401)
    expect(countPasskeys(h.db)).toBe(1)
  })

  it('adds a second passkey vouched for by the first', async () => {
    const { device: first } = await enrolWithCode(h)
    const { res } = await enrolWithCode(h, undefined, first)
    expect(res.json()).toEqual({ enrolled: true })
    expect(countPasskeys(h.db)).toBe(2)
    expect(h.bot.alert).toHaveBeenCalledTimes(2)
  })

  it('keeps the code when the step-up is missing, so the owner can try again', async () => {
    const { device: first } = await enrolWithCode(h)
    const { code } = await issue(h)
    const device = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin)
    const options = (await post(h, '/v1/owner/passkeys/options', { code })).json()
    const response = device.register(options.registration.challenge)
    expect((await post(h, '/v1/owner/passkeys', { code, response })).statusCode).toBe(401)
    const vouched = await post(h, '/v1/owner/passkeys', {
      code,
      response,
      assertion: first.assert(options.stepUp.challenge),
    })
    expect(vouched.json()).toEqual({ enrolled: true })
  })

  it('answers a passkey already enrolled with 409, and keeps the code', async () => {
    const { device } = await enrolWithCode(h)
    vi.mocked(h.bot.alert).mockClear()
    const { code } = await issue(h)
    const options = (await post(h, '/v1/owner/passkeys/options', { code })).json()
    const twice = await post(h, '/v1/owner/passkeys', {
      code,
      response: device.register(options.registration.challenge),
    })
    expect(twice.statusCode).toBe(409)
    expect(twice.json()).toEqual({ error: 'passkey_exists' })
    expect((await post(h, '/v1/owner/passkeys/options', { code })).statusCode).toBe(200)
    expect(h.bot.alert).not.toHaveBeenCalled()
  })

  it('lets only one of two first enrolments sent at once through', async () => {
    const pending = async () => {
      const { code } = await issue(h)
      const device = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin)
      const options = (await post(h, '/v1/owner/passkeys/options', { code })).json()
      return () =>
        post(h, '/v1/owner/passkeys', {
          code,
          response: device.register(options.registration.challenge),
        })
    }
    const sends = [await pending(), await pending()]
    const codes = await Promise.all(sends.map((send) => send()))
    expect(codes.map((r) => r.statusCode).sort()).toEqual([200, 409])
    expect(countPasskeys(h.db)).toBe(1)
  })

  it('lets only one of an admin and a code enrolment sent at once through', async () => {
    const { code } = await issue(h)
    const phone = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin)
    const options = (await post(h, '/v1/owner/passkeys/options', { code })).json()
    const laptop = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin)
    const adminOptions = (
      await h.app.inject({
        method: 'POST',
        url: '/v1/admin/passkeys/options',
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      })
    ).json()
    const both = await Promise.all([
      post(h, '/v1/owner/passkeys', {
        code,
        response: phone.register(options.registration.challenge),
      }),
      h.app.inject({
        method: 'POST',
        url: '/v1/admin/passkeys',
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
        payload: { response: laptop.register(adminOptions.challenge) },
      }),
    ])
    expect(both.map((r) => r.statusCode).sort()).toEqual([200, 409])
    expect(countPasskeys(h.db)).toBe(1)
  })

  it('spends one step-up and one code once, however many times they are sent at once', async () => {
    const { device: first } = await enrolWithCode(h)
    const { code } = await issue(h)
    const options = (await post(h, '/v1/owner/passkeys/options', { code })).json()
    const assertion = first.assert(options.stepUp.challenge)
    const sends = await Promise.all(
      [0, 1, 2].map(() =>
        post(h, '/v1/owner/passkeys', {
          code,
          response: softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin).register(
            options.registration.challenge,
          ),
          assertion,
        }),
      ),
    )
    expect(sends.filter((r) => r.statusCode === 200)).toHaveLength(1)
    expect(countPasskeys(h.db)).toBe(2)
  })

  it('names the passkey that vouched for a new one in the audit', async () => {
    const { device: first } = await enrolWithCode(h)
    await enrolWithCode(h, undefined, first)
    const details = h.db
      .select()
      .from(schema.auditLog)
      .all()
      .filter((row) => row.event === 'passkey_enrolled')
      .map((row) => row.detail)
    expect(details[1]).toMatchObject({ via: 'code', voucher: first.id.slice(0, 8) })
  })

  it('refuses a registration whose verified id is not the one it claims', async () => {
    const { code } = await issue(h)
    const device = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin)
    const options = (await post(h, '/v1/owner/passkeys/options', { code })).json()
    const response = device.register(options.registration.challenge)
    const res = await post(h, '/v1/owner/passkeys', {
      code,
      response: { ...response, id: 'AAAAAAAAAAAAAAAAAAAAAA', rawId: 'AAAAAAAAAAAAAAAAAAAAAA' },
    })
    expect(res.statusCode).toBe(400)
    expect(countPasskeys(h.db)).toBe(0)
  })

  it('prunes expired codes and challenges', async () => {
    const { code } = await issue(h)
    await post(h, '/v1/owner/passkeys/options', { code })
    pruneExpired(h.db, NOW)
    expect(h.db.select().from(schema.enrolCodes).all()).toHaveLength(1)
    expect(h.db.select().from(schema.passkeyChallenges).all()).toHaveLength(1)
    pruneExpired(h.db, new Date(NOW.getTime() + 11 * 60_000))
    expect(h.db.select().from(schema.enrolCodes).all()).toHaveLength(0)
    expect(h.db.select().from(schema.passkeyChallenges).all()).toHaveLength(0)
  })

  it('refuses a code after its ten minutes', async () => {
    const { code } = await issue(h)
    h.clock.now = new Date(NOW.getTime() + 11 * 60_000)
    expect((await post(h, '/v1/owner/passkeys/options', { code })).statusCode).toBe(401)
  })

  it("refuses an answer to one code's challenge sent with another code", async () => {
    const first = await issue(h)
    const second = await issue(h)
    const device = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin)
    const options = (await post(h, '/v1/owner/passkeys/options', { code: first.code })).json()
    const res = await post(h, '/v1/owner/passkeys', {
      code: second.code,
      response: device.register(options.registration.challenge),
    })
    expect(res.statusCode).toBe(400)
    expect(countPasskeys(h.db)).toBe(0)
  })

  it('refuses a code that was never issued', async () => {
    const res = await post(h, '/v1/owner/passkeys/options', { code: 'x'.repeat(32) })
    expect(res.statusCode).toBe(401)
  })

  it('serves the page with the strict CSP, and no code in it', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/owner/enrol' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-security-policy']).toContain("default-src 'none'")
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000')
    expect(res.body).toContain('<script src="/owner/enrol.js"></script>')
  })

  it.each(['/owner/enrol.js', '/owner/approve.js'])(
    'serves %s as valid JavaScript',
    async (url) => {
      const res = await h.app.inject({ method: 'GET', url })
      expect(() => new Script(res.body)).not.toThrow()
    },
  )
})
