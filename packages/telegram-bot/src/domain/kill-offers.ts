/** How long a Phantom kill button stays live after the guard-core kill it belongs to. */
export const KILL_OFFER_TTL_MS = 15 * 60_000

export interface KillOffer {
  chatId: number
  messageId: number
  /** The message as posted, so the button can be removed without losing what it said. */
  text: string
  at: number
}

/**
 * The live Phantom kill buttons, tracked per message. A button removes an onchain limit only; pressed
 * long after its guard-core kill, or after a later one, it leaves the guard running with no limit to
 * stop at, half a kill. So only the newest offer stays live, and only for KILL_OFFER_TTL_MS.
 */
export class KillOffers {
  #offers: KillOffer[] = []

  /** Records the new offer and hands back every older one, which must now be retired. */
  offer(offer: KillOffer): KillOffer[] {
    const older = this.#offers
    this.#offers = [offer]
    return older
  }

  expired(now: Date): KillOffer[] {
    const due = this.#offers.filter((offer) => now.getTime() - offer.at >= KILL_OFFER_TTL_MS)
    this.#offers = this.#offers.filter((offer) => !due.includes(offer))
    return due
  }
}
