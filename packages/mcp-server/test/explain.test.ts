import { SHARED_REJECT_CODES } from '@agentguard/shared'
import { describe, expect, it } from 'vitest'
import { explainReject, explainStatus } from '../src/domain/explain.js'
import { MAX_BODY_CHARS, wrapUntrusted } from '../src/domain/untrusted.js'

describe('explainReject', () => {
  it('has a plain-English reason for every shared code', () => {
    for (const code of SHARED_REJECT_CODES) {
      expect(explainReject(code)).not.toMatch(/no description/)
    }
  })

  it('still names a code it does not know', () => {
    expect(explainReject('NEW_CODE')).toBe('NEW_CODE: no description')
  })
})

describe('explainStatus', () => {
  it('tells the model to inform the user and poll on pending_approval', () => {
    const text = explainStatus('pending_approval', [])
    expect(text).toMatch(/Tell the user/)
    expect(text).toMatch(/check_intent/)
  })

  it('lists each reject reason', () => {
    const text = explainStatus('rejected', ['DAILY_EXCEEDED', 'PAUSED'])
    expect(text).toMatch(/Do not retry/)
    expect(text).toMatch(/- DAILY_EXCEEDED: the payment would go over the daily spending limit/)
    expect(text).toMatch(/- PAUSED: /)
  })
})

describe('wrapUntrusted', () => {
  it('fences the body with the nonce on both markers', () => {
    expect(wrapUntrusted('hello', 'n1')).toBe(
      '<untrusted-content id="n1">\nhello\n</untrusted-content id="n1">',
    )
  })

  it('truncates a body that would flood the context', () => {
    const wrapped = wrapUntrusted('x'.repeat(MAX_BODY_CHARS + 10), 'n')
    expect(wrapped).toMatch(/Body truncated to 100000 of 100010 characters/)
    expect(wrapped.length).toBeLessThan(MAX_BODY_CHARS + 200)
  })
})
