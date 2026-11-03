/**
 * Runs one task at a time per key. Every payment reads the agent's spend for the day and later adds
 * to it; two payments for the same agent in flight at once would both pass against the old total.
 */
export type Serial = <T>(key: string, task: () => Promise<T>) => Promise<T>

export function serial(): Serial {
  const tails = new Map<string, Promise<unknown>>()
  return async (key, task) => {
    const run = (tails.get(key) ?? Promise.resolve()).then(task)
    const tail = run.catch(() => undefined)
    tails.set(key, tail)
    try {
      return await run
    } finally {
      if (tails.get(key) === tail) {
        tails.delete(key)
      }
    }
  }
}
