import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

/** What the agents table stores. The token itself is shown once, at creation, and never again. */
export function hashToken(token: string): string {
  return sha256(token).toString('hex')
}

/**
 * Compares digests rather than the strings themselves: digests are always 32 bytes, so neither the
 * comparison nor an early length check can leak how much of the token was right.
 */
export function tokenMatches(presented: string, expected: string): boolean {
  return timingSafeEqual(sha256(presented), sha256(expected))
}

export function matchesHash(presented: string, expectedHash: string): boolean {
  return timingSafeEqual(sha256(presented), Buffer.from(expectedHash, 'hex'))
}

const BEARER = /^Bearer (\S+)$/

export function parseBearer(header: string | undefined): string | undefined {
  if (header === undefined) {
    return undefined
  }
  return BEARER.exec(header)?.[1]
}

/** X-Guard-Signature on the approval webhook: HMAC-SHA256 of the exact bytes we send. */
export function signWebhook(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

export function webhookSignatureValid(body: string, secret: string, signature: string): boolean {
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest()
  let presented: Buffer
  try {
    presented = Buffer.from(signature, 'hex')
  } catch {
    return false
  }
  if (presented.length !== expected.length) {
    return false
  }
  return timingSafeEqual(presented, expected)
}
