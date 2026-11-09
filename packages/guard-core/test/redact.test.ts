import { describe, expect, it } from 'vitest'
import { redactUrls, serializeError } from '../src/domain/redact.js'

const RPC = 'https://base-mainnet.g.alchemy.com/v2/secret-key'

class HttpRequestError extends Error {
  url = RPC
  details = `fetch failed at ${RPC}`
}

describe('serializeError', () => {
  it('keeps no RPC URL from the message, the stack, own fields or the cause', () => {
    const err = new HttpRequestError(`HTTP request failed.\n\nURL: ${RPC}`, {
      cause: new Error(`connect ECONNREFUSED ${RPC}`),
    })
    const logged = serializeError(err)
    expect(JSON.stringify(logged)).not.toContain('secret-key')
    expect(logged).toMatchObject({
      type: 'Error',
      message: 'HTTP request failed.\n\nURL: <url>',
      url: '<url>',
      details: 'fetch failed at <url>',
      cause: { message: 'connect ECONNREFUSED <url>' },
    })
  })

  it('leaves an error without a URL as pino would log it', () => {
    const logged = serializeError(new TypeError('bad input'))
    expect(logged).toMatchObject({ type: 'TypeError', message: 'bad input' })
    expect(logged.stack).toContain('bad input')
    expect(logged).not.toHaveProperty('cause')
  })
})

describe('redactUrls', () => {
  it('walks arrays and objects, and stops at a bounded depth', () => {
    expect(redactUrls([{ a: `see ${RPC}` }, 1, null])).toEqual([{ a: 'see <url>' }, 1, null])
    const deep = { a: { b: { c: { d: { e: { f: RPC } } } } } }
    expect(redactUrls(deep)).toEqual(deep)
  })
})
