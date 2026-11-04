import { describe, expect, it } from 'vitest'
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

  it('forgets expired clients instead of growing without bound', () => {
    const { check, advance } = clocked(1)
    for (let i = 0; i < 10_000; i++) {
      check(`client-${i}`)
    }
    advance(60_000)
    // The sweep runs here; a client from before the sweep starts afresh.
    expect(check('new').ok).toBe(true)
    expect(check('client-0').ok).toBe(true)
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
