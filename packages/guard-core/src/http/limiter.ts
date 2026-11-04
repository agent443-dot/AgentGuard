/**
 * A fixed-window counter per key. @fastify/rate-limit runs only the first of several limiters on a
 * request, so the agent routes, which need two (per address and per token), count here instead.
 * In memory: fine for one guard process, which is what the deployment runs.
 */
export function windowLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  let windowStart = now()
  let counts = new Map<string, number>()

  return function hit(key: string): { allowed: true } | { allowed: false; retryAfterS: number } {
    const at = now()
    if (at - windowStart >= windowMs) {
      // A new window forgets every key, so the map never outgrows one window's callers.
      windowStart = at
      counts = new Map()
    }
    const count = (counts.get(key) ?? 0) + 1
    counts.set(key, count)
    if (count <= max) {
      return { allowed: true }
    }
    return { allowed: false, retryAfterS: Math.ceil((windowStart + windowMs - at) / 1000) }
  }
}
