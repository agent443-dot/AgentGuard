/** How long an agent runs in shadow mode before the bot offers to take it live. */
export const GRADUATION_MS = 3 * 86_400_000

export interface ShadowTotal {
  agentId: string
  since: Date
  spent: bigint
  payments: number
}

/**
 * What shadow mode would have spent, per agent, counted from the shadowed events since the bot
 * started. In memory: after a restart the count and the three days start again.
 */
export class ShadowLedger {
  readonly #agents = new Map<string, { since: number; spent: bigint; payments: number }>()
  readonly #offered = new Set<string>()

  record(agentId: string, amount: bigint, at: Date): void {
    const entry = this.#agents.get(agentId) ?? { since: at.getTime(), spent: 0n, payments: 0 }
    entry.spent += amount
    entry.payments += 1
    this.#agents.set(agentId, entry)
  }

  get(agentId: string): ShadowTotal | undefined {
    const entry = this.#agents.get(agentId)
    return entry === undefined
      ? undefined
      : { agentId, since: new Date(entry.since), spent: entry.spent, payments: entry.payments }
  }

  /** Each agent once: the graduation offer is a suggestion, not a reminder. */
  due(now: Date): ShadowTotal[] {
    const due: ShadowTotal[] = []
    for (const [agentId, entry] of this.#agents) {
      if (!this.#offered.has(agentId) && now.getTime() - entry.since >= GRADUATION_MS) {
        this.#offered.add(agentId)
        due.push({
          agentId,
          since: new Date(entry.since),
          spent: entry.spent,
          payments: entry.payments,
        })
      }
    }
    return due
  }
}
