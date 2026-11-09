import { describe, expect, it } from 'vitest'
import { ADMIN_TOKEN, basePolicy, harness } from './harness.js'

async function put(body: object) {
  const h = await harness()
  const res = await h.app.inject({
    method: 'PUT',
    url: '/v1/admin/policy/agent-1',
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    payload: body,
  })
  const read = await h.app.inject({
    method: 'GET',
    url: '/v1/admin/policy/agent-1',
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  })
  return { res, read }
}

describe('the policy fields added after launch', () => {
  it('reads a policy that sets none of them back with the defaults', async () => {
    const { res, read } = await put(basePolicy)
    expect(res.statusCode).toBe(200)
    expect(read.json()).toMatchObject({
      mode: 'live',
      priceIncreaseMaxPct: 100,
      maxPaymentsPerMinute: 10,
      requireMandate: false,
    })
  })

  it('keeps the values a policy sets', async () => {
    const fields = {
      mode: 'shadow',
      priceIncreaseMaxPct: 25,
      maxPaymentsPerMinute: 3,
      requireMandate: true,
    }
    const { read } = await put({ ...basePolicy, ...fields })
    expect(read.json()).toMatchObject(fields)
  })

  it('keeps a stored field that a later policy leaves out, so an older client changes nothing', async () => {
    const h = await harness({ policy: { mode: 'shadow', maxPaymentsPerMinute: 2 } })
    await h.app.inject({
      method: 'PUT',
      url: '/v1/admin/policy/agent-1',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: basePolicy,
    })
    const read = await h.app.inject({
      method: 'GET',
      url: '/v1/admin/policy/agent-1',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    })
    expect(read.json()).toMatchObject({ mode: 'shadow', maxPaymentsPerMinute: 2 })
  })

  it('answers the PUT with the policy as stored, kept fields included', async () => {
    const h = await harness({ policy: { mode: 'shadow' } })
    const res = await h.app.inject({
      method: 'PUT',
      url: '/v1/admin/policy/agent-1',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: basePolicy,
    })
    expect(res.json()).toMatchObject({ mode: 'shadow', priceIncreaseMaxPct: 100 })
  })

  it.each([
    ['an unknown mode', { mode: 'dry-run' }],
    ['a fractional percentage', { priceIncreaseMaxPct: 1.5 }],
    ['a negative percentage', { priceIncreaseMaxPct: -1 }],
    ['a breaker of zero', { maxPaymentsPerMinute: 0 }],
    ['a string for a boolean', { requireMandate: 'yes' }],
  ])('refuses %s', async (_case, field) => {
    const { res } = await put({ ...basePolicy, ...field })
    expect(res.statusCode).toBe(400)
  })
})
