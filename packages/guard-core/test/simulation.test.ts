import type { PayIntent } from '@agentguard/shared'
import { describe, expect, it } from 'vitest'
import { checkSimulation } from '../src/domain/simulation.js'

const intent = { token: 'USDC', amount: '1000000' } as PayIntent
const run = (...balanceChanges: { token: string; delta: string }[]) =>
  checkSimulation({ summary: '', balanceChanges }, intent)

describe('checkSimulation', () => {
  it('accepts a loss of exactly the amount', () => {
    expect(run({ token: 'USDC', delta: '-1000000' })).toEqual([])
  })

  it('accepts no reported change at all', () => {
    expect(run()).toEqual([])
  })

  it('ignores other tokens, such as the fee in the native token', () => {
    expect(run({ token: 'SOL', delta: '-5000' }, { token: 'USDC', delta: '-1000000' })).toEqual([])
  })

  it('refuses a loss beyond the amount, even split across entries', () => {
    expect(run({ token: 'USDC', delta: '-1000000' }, { token: 'USDC', delta: '-1' })).toEqual([
      'SIM_UNEXPECTED_EFFECT',
    ])
  })

  it.each(['1.5', '-', '', '0x10', '--1'])('fails on an unreadable delta %j', (delta) => {
    expect(run({ token: 'USDC', delta })).toEqual(['SIM_FAILED'])
  })
})
