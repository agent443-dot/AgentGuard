export interface RateLimiterOptions {
  /** Requests allowed per client in one window. */
  limit: number
  windowMs: number
  now?: () => number
}

export type RateDecision = { ok: true } | { ok: false; retryAfterSeconds: number }

/** Past this many tracked clients, expired windows are swept so the map cannot grow without bound. */
const SWEEP_AT = 10_000

/**
 * A fixed window per client. Coarse, but it caps what a token thief or a guessing client can do per
 * minute, and it costs nothing to reason about.
 */
export function rateLimiter({ limit, windowMs, now = Date.now }: RateLimiterOptions) {
  const windows = new Map<string, { start: number; count: number }>()

  function sweep(at: number) {
    for (const [key, window] of windows) {
      if (at - window.start >= windowMs) {
        windows.delete(key)
      }
    }
  }

  return function check(key: string): RateDecision {
    const at = now()
    if (windows.size >= SWEEP_AT) {
      sweep(at)
    }
    const current = windows.get(key)
    if (current === undefined || at - current.start >= windowMs) {
      windows.set(key, { start: at, count: 1 })
      return { ok: true }
    }
    if (current.count >= limit) {
      return { ok: false, retryAfterSeconds: Math.ceil((current.start + windowMs - at) / 1000) }
    }
    current.count++
    return { ok: true }
  }
}

export type RateLimiter = ReturnType<typeof rateLimiter>
