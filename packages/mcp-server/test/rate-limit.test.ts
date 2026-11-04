import { describe, expect, it } from 'vitest'
import { clientKey } from '../src/domain/client-key.js'
import { hostOf, isLoopback } from '../src/domain/loopback.js'
import { rateLimiter } from '../src/domain/rate-limit.js'

function clocked(limit: number, windowMs = 60_000) {
  let now = 0
  const check = rateLimiter({ limit, windowMs, now: () => now })
  return { check, advance: (ms: number) => (now += ms) }
}

describe('rateLimiter', () => {
  it('allows up to the limit, then refuses with the seconds left in the window', () => {
    const { check, advance } = clocked(3)
    expect([check('a'), check('a'), check('a')].every((d) => d.ok)).toBe(true)
    advance(15_500)
    expect(check('a')).toEqual({ ok: false, retryAfterSeconds: 45 })
  })

  it('counts each client on its own', () => {
    const { check } = clocked(1)
    expect(check('a').ok).toBe(true)
    expect(check('a').ok).toBe(false)
    expect(check('b').ok).toBe(true)
  })

  it('starts a new window once the old one has passed', () => {
    const { check, advance } = clocked(1)
    check('a')
    advance(60_000)
    expect(check('a').ok).toBe(true)
  })

  it('refuses new clients once the map is full of live windows, but serves known ones', () => {
    let now = 0
    const check = rateLimiter({ limit: 5, windowMs: 60_000, maxClients: 3, now: () => now })
    for (const key of ['a', 'b', 'c']) {
      expect(check(key).ok).toBe(true)
    }
    expect(check('d')).toEqual({ ok: false, retryAfterSeconds: 60 })
    expect(check('a').ok).toBe(true)
    now = 60_000
    // Every window has expired, so the sweep makes room again.
    expect(check('d').ok).toBe(true)
  })
})

describe('loopback', () => {
  it.each([
    ['127.0.0.1', true],
    ['localhost', true],
    ['::1', true],
    ['0.0.0.0', false],
    ['10.0.0.5', false],
  ])('isLoopback(%s) is %s', (host, expected) => {
    expect(isLoopback(host)).toBe(expected)
  })

  it.each([
    ['localhost:8789', 'localhost'],
    ['[::1]:8789', '[::1]'],
    ['evil.example', 'evil.example'],
    [undefined, ''],
  ])('hostOf(%s) is %s', (header, expected) => {
    expect(hostOf(header)).toBe(expected)
  })
})

describe('clientKey', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['2001:db8:aa:bb:1:2:3:4', '2001:db8:aa:bb::/64'],
    ['2001:db8:aa:bb::9', '2001:db8:aa:bb::/64'],
    ['2001:0DB8:00aa:00bb:ffff::1', '2001:db8:aa:bb::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    [undefined, 'unknown'],
    ['', 'unknown'],
  ])('keys %s as %s', (address, expected) => {
    expect(clientKey(address)).toBe(expected)
  })

  it('puts every address in one /64 under one key', () => {
    expect(clientKey('2001:db8:1:2:aaaa::1')).toBe(clientKey('2001:db8:1:2:bbbb:cccc:dddd:eeee'))
  })

  it('keeps an address it cannot parse whole rather than guess', () => {
    expect(clientKey('1:2:3')).toBe('1:2:3')
    expect(clientKey('1::2::3')).toBe('1::2::3')
    expect(clientKey('zz::1')).toBe('zz::1')
  })
})
