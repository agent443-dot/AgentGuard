import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  hashToken,
  matchesHash,
  parseBearer,
  signWebhook,
  tokenMatches,
  webhookSignatureValid,
} from '../src/domain/auth.js'

const SECRET = 'a-webhook-secret'

describe('tokens', () => {
  it('matches a token against itself and nothing else', () => {
    expect(tokenMatches('s3cret', 's3cret')).toBe(true)
    expect(tokenMatches('s3cret', 's3crew')).toBe(false)
  })

  it('does not treat a prefix as a match', () => {
    expect(tokenMatches('s3c', 's3cret')).toBe(false)
    expect(tokenMatches('s3cretlonger', 's3cret')).toBe(false)
  })

  it('matches against a stored hash without the token ever being stored', () => {
    const stored = hashToken('agent-token')
    expect(stored).toMatch(/^[0-9a-f]{64}$/)
    expect(stored).not.toContain('agent-token')
    expect(matchesHash('agent-token', stored)).toBe(true)
    expect(matchesHash('other-token', stored)).toBe(false)
  })
})

describe('parseBearer', () => {
  it('reads the token out of an Authorization header', () => {
    expect(parseBearer('Bearer abc123')).toBe('abc123')
  })

  it.each([undefined, '', 'abc123', 'bearer abc123', 'Bearer', 'Bearer ', 'Basic abc123'])(
    'returns nothing for %o',
    (header) => {
      expect(parseBearer(header)).toBeUndefined()
    },
  )
})

describe('webhook signatures', () => {
  const body = JSON.stringify({ intent: { id: 'intent-1' } })

  it('accepts the signature it produced', () => {
    expect(webhookSignatureValid(body, SECRET, signWebhook(body, SECRET))).toBe(true)
  })

  it('rejects a body that changed after signing', () => {
    const signature = signWebhook(body, SECRET)
    expect(webhookSignatureValid(body.replace('intent-1', 'intent-2'), SECRET, signature)).toBe(
      false,
    )
  })

  it('rejects a signature made with another secret', () => {
    const forged = createHmac('sha256', 'wrong-secret').update(body).digest('hex')
    expect(webhookSignatureValid(body, SECRET, forged)).toBe(false)
  })

  it.each(['', 'not-hex', 'ab', 'zz'.repeat(32)])('rejects the malformed signature %o', (sig) => {
    expect(webhookSignatureValid(body, SECRET, sig)).toBe(false)
  })
})
