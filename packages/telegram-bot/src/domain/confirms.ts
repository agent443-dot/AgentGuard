import { randomBytes } from 'node:crypto'

/** A button that is not pressed in this long does nothing: the owner asks again. */
export const CONFIRM_TTL_MS = 10 * 60_000

/**
 * What a button will do when pressed, behind a short random id. Callback data is capped at 64 bytes
 * and an agent id alone can be 64 characters, so the id is all the button carries.
 */
export class Confirms<T> {
  readonly #items = new Map<string, { value: T; until: number }>()
  readonly #id: () => string

  constructor(id: () => string = () => randomBytes(9).toString('base64url')) {
    this.#id = id
  }

  add(value: T, now: Date, ttlMs = CONFIRM_TTL_MS): string {
    this.#prune(now)
    const id = this.#id()
    this.#items.set(id, { value, until: now.getTime() + ttlMs })
    return id
  }

  /** Once only: a second press of the same button finds nothing. */
  take(id: string, now: Date): T | undefined {
    this.#prune(now)
    const item = this.#items.get(id)
    this.#items.delete(id)
    return item?.value
  }

  #prune(now: Date): void {
    for (const [id, { until }] of this.#items) {
      if (now.getTime() >= until) {
        this.#items.delete(id)
      }
    }
  }
}
