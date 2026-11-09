import { Script } from 'node:vm'
import { beforeEach, describe, expect, it } from 'vitest'
import { countPasskeys } from '../src/db/passkeys.js'
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

  it('enrols a passkey from the public page, which then approves', async () => {
    const { code } = await issue(h)
    const device = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin)
    const options = (await post(h, '/v1/owner/passkeys/options', { code })).json()
    const res = await post(h, '/v1/owner/passkeys', {
      code,
      response: device.register(options.challenge),
    })
    expect(res.json()).toEqual({ enrolled: true })
    expect(countPasskeys(h.db)).toBe(1)
    expect(h.auditEvents()).toContain('passkey_enrolled')
  })

  it('takes each code once', async () => {
    const { code } = await issue(h)
    const device = softAuthenticator(PASSKEY_RP.id, PASSKEY_RP.origin)
    const options = (await post(h, '/v1/owner/passkeys/options', { code })).json()
    await post(h, '/v1/owner/passkeys', { code, response: device.register(options.challenge) })
    const again = await post(h, '/v1/owner/passkeys', {
      code,
      response: device.register(options.challenge),
    })
    expect(again.statusCode).toBe(401)
    expect(countPasskeys(h.db)).toBe(1)
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
      response: device.register(options.challenge),
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
