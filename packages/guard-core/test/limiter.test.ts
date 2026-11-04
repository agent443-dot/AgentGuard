import { describe, expect, it } from 'vitest'
import { windowLimiter } from '../src/http/limiter.js'

describe('windowLimiter', () => {
  it('allows max hits per key per window, then says how long to wait', () => {
    let t = 0
    const hit = windowLimiter(2, 60_000, () => t)
    expect(hit('a')).toEqual({ allowed: true })
    expect(hit('a')).toEqual({ allowed: true })
    t = 15_000
    expect(hit('a')).toEqual({ allowed: false, retryAfterS: 45 })
  })

  it('counts keys apart', () => {
    const hit = windowLimiter(1, 60_000, () => 0)
    expect(hit('a').allowed).toBe(true)
    expect(hit('b').allowed).toBe(true)
    expect(hit('a').allowed).toBe(false)
  })

  it('starts over in a new window', () => {
    let t = 0
    const hit = windowLimiter(1, 60_000, () => t)
    hit('a')
    expect(hit('a').allowed).toBe(false)
    t = 60_000
    expect(hit('a').allowed).toBe(true)
  })
})
