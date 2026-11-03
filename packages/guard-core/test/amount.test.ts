import { describe, expect, it } from 'vitest'
import { parseAmount, toAmount } from '../src/domain/amount.js'

describe('parseAmount', () => {
  it('parses atomic unit strings', () => {
    expect(parseAmount('0')).toBe(0n)
    expect(parseAmount('1000000')).toBe(1_000_000n)
  })

  it('keeps precision past what a double can hold', () => {
    expect(parseAmount('9007199254740993')).toBe(9_007_199_254_740_993n)
  })

  it.each(['', ' ', '1.5', '-1', '0x10', '1e6', '01', '1_000', 'NaN', 'Infinity'])(
    'rejects %o',
    (value) => {
      expect(() => parseAmount(value)).toThrow(/invalid_amount/)
    },
  )
})

describe('toAmount', () => {
  it('round-trips through parseAmount', () => {
    expect(parseAmount(toAmount(1_000_000n))).toBe(1_000_000n)
  })

  it('rejects negatives, which would silently become a huge allowance', () => {
    expect(() => toAmount(-1n)).toThrow(/negative_amount/)
  })
})
