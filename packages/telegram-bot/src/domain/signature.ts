import { createHmac, timingSafeEqual } from 'node:crypto'

const HEX_SHA256 = /^[0-9a-f]{64}$/i

/**
 * X-Guard-Signature is HMAC-SHA256 of the exact request bytes, hex encoded. It must be checked on the
 * raw body: parsing and re-serialising would change the bytes and break legitimate requests.
 */
export function signatureValid(rawBody: string, secret: string, header: unknown): boolean {
  // The shape check also fixes the length, so timingSafeEqual never sees buffers of different sizes.
  if (!wellFormed(header)) {
    return false
  }
  return timingSafeEqual(Buffer.from(header, 'hex'), digest(rawBody, secret))
}

/** Cheap enough to run before the body is read: no secret involved, so nothing to time. */
export function wellFormed(header: unknown): header is string {
  return typeof header === 'string' && HEX_SHA256.test(header)
}

export function sign(rawBody: string, secret: string): string {
  return digest(rawBody, secret).toString('hex')
}

function digest(rawBody: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest()
}
