import type { ChainId, PayIntent, RejectCode } from '@agentguard/shared'
import type { PaymentRequirements, SchemeNetworkClient } from '@x402/core/types'

/**
 * Builds and signs x402 payments for one chain. The scheme it returns signs `intent` and nothing
 * else: whatever the SDK puts in front of it is inspected first, and anything more than that one
 * payment throws SigningRefused instead of a signature.
 */
export interface PaymentScheme {
  readonly chain: ChainId
  forIntent(intent: PayIntent, requirements: PaymentRequirements): SchemeNetworkClient
}

export class SigningRefused extends Error {
  constructor(readonly reasons: RejectCode[]) {
    super(`signing_refused: ${reasons.join(',')}`)
  }
}
