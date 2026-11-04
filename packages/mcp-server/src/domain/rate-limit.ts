export interface RateLimiterOptions {
  /** Requests allowed per client in one window. */
  limit: number
  windowMs: number
  /** Clients tracked at once. Past it, new clients wait rather than grow the map. */
  maxClients?: number
  now?: () => number
}

export type RateDecision = { ok: true } | { ok: false; retryAfterSeconds: number }

/**
 * A fixed window per client. Coarse, but it caps what a token thief or a guessing client can do per
 * minute, and it costs nothing to reason about.
 */
export function rateLimiter(options: RateLimiterOptions) {
  const { limit, windowMs, maxClients = 10_000, now = Date.now } = options
  const windows = new Map<string, { start: number; count: number }>()
  let lastSweep = Number.NEGATIVE_INFINITY

  function sweep(at: number) {
    // At most once a second: under a flood of new clients a sweep per request would cost more than
    // the requests themselves.
    if (at - lastSweep < 1000) {
      return
    }
    lastSweep = at
    for (const [key, window] of windows) {
      if (at - window.start >= windowMs) {
        windows.delete(key)
      }
    }
  }

  return function check(key: string): RateDecision {
    const at = now()
    const current = windows.get(key)
    if (current === undefined && windows.size >= maxClients) {
      sweep(at)
      if (windows.size >= maxClients) {
        // A flood of fresh addresses fills the map within one window. Refusing newcomers until it
        // drains bounds memory; clients already tracked keep their own allowance.
        return { ok: false, retryAfterSeconds: Math.ceil(windowMs / 1000) }
      }
    }
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
