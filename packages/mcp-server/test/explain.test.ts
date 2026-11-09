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
    const text = explainStatus('pending_approval', [], 'transfer')
    expect(text).toMatch(/Tell the user/)
    expect(text).toMatch(/check_intent/)
    expect(text).not.toMatch(/paid_fetch/)
  })

  it('tells the model to repeat an approved x402 request, and only an x402 one', () => {
    expect(explainStatus('pending_approval', [], 'x402')).toMatch(
      /Once check_intent reports approved, call paid_fetch again with exactly the same url/,
    )
    expect(explainStatus('approved', [], 'x402')).toMatch(/that one request only/)
    expect(explainStatus('approved', [], 'transfer')).toBe(
      'The payment was approved and is being sent.',
    )
  })

  it('lists each reject reason', () => {
    const text = explainStatus('rejected', ['DAILY_EXCEEDED', 'PAUSED'], 'transfer')
    expect(text).toMatch(/Do not retry/)
    expect(text).toMatch(/- DAILY_EXCEEDED: the payment would go over the daily spending limit/)
    expect(text).toMatch(/- PAUSED: /)
  })
})

describe('task budget and breaker codes', () => {
  it('tells the agent to open a task budget when one is required', () => {
    const text = explainStatus('rejected', ['MANDATE_REQUIRED'], 'transfer')
    expect(text).toMatch(
      /- MANDATE_REQUIRED: the owner requires every payment to belong to a task budget/,
    )
    expect(text).toMatch(
      /Open a task budget for this task with start_task, then repeat the payment with its mandateId\./,
    )
  })

  it.each(['MANDATE_EXCEEDED', 'MANDATE_EXPIRED'])('tells the agent to stop on %s', (code) => {
    expect(explainStatus('rejected', [code], 'x402')).toMatch(
      /Stop paying for this task and tell the user\./,
    )
  })

  it('tells the agent the breaker paused it', () => {
    const text = explainStatus('rejected', ['BREAKER_TRIPPED'], 'x402')
    expect(text).toMatch(/AgentGuard paused this agent until the owner resumes it/)
    expect(text).toMatch(/Stop making payments and tell the user/)
  })

  it('gives each piece of advice once', () => {
    const text = explainStatus('rejected', ['MANDATE_EXCEEDED', 'MANDATE_EXCEEDED'], 'transfer')
    expect(text.match(/Stop paying for this task/g)).toHaveLength(1)
  })
})

describe('shadow mode', () => {
  it('says nothing was paid, for a transfer and for a paid fetch', () => {
    expect(explainStatus('shadowed', [], 'transfer')).toMatch(
      /^Shadow mode: nothing was paid and no money moved\./,
    )
    expect(explainStatus('shadowed', [], 'x402')).toMatch(
      /website's unpaid answer, not the paid content/,
    )
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
