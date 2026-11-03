import { describe, expect, it } from 'vitest'
import { formatAmount, formatUsd, parseUsd } from '../src/domain/usd.js'

function atomic(value: string): bigint {
  const parsed = parseUsd(value)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  return parsed.atomic
}

describe('parseUsd', () => {
  it.each([
    ['0', 0n],
    ['1', 1_000_000n],
    ['0.1', 100_000n],
    ['0.25', 250_000n],
    ['12.5', 12_500_000n],
    ['0.000001', 1n],
    ['999999999999.999999', 999_999_999_999_999_999n],
  ])('converts %s to %s atomic units', (input, expected) => {
    expect(atomic(input)).toBe(expected)
  })

  it('is exact where a float is not', () => {
    // 0.1 + 0.2 in floating point is 0.30000000000000004.
    expect(atomic('0.1') + atomic('0.2')).toBe(atomic('0.3'))
  })

  it.each([
    ['negative', '-1'],
    ['plus sign', '+1'],
    ['NaN', 'NaN'],
    ['Infinity', 'Infinity'],
    ['exponent', '1e3'],
    ['small exponent', '1e-7'],
    ['seven decimals, which would round', '0.0000001'],
    ['seven decimals on a whole amount', '1.1234567'],
    ['empty', ''],
    ['whitespace', ' 1'],
    ['trailing whitespace', '1 '],
    ['bare dot', '.5'],
    ['trailing dot', '1.'],
    ['leading zero', '01'],
    ['comma decimal', '1,50'],
    ['thousands separator', '1,000'],
    ['dollar sign', '$1'],
    ['hex', '0x10'],
    ['too large', '1000000000000'],
    ['two dots', '1.2.3'],
  ])('rejects %s (%s)', (_name, input) => {
    const parsed = parseUsd(input)
    expect(parsed.ok).toBe(false)
  })

  it('explains the expected format', () => {
    const parsed = parseUsd('-1')
    expect(parsed.ok || parsed.error).toMatch(/at most 6 decimal places/)
  })
})

describe('formatUsd', () => {
  it.each([
    [0n, '$0.00'],
    [1n, '$0.000001'],
    [10_000n, '$0.01'],
    [1_500_000n, '$1.50'],
    [1_234_567n, '$1.234567'],
    [-2_000_000n, '-$2.00'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatUsd(input)).toBe(expected)
  })

  it('round-trips parsed values', () => {
    expect(formatUsd(atomic('42.000101'))).toBe('$42.000101')
  })
})

describe('formatAmount', () => {
  it('formats atomic strings and leaves anything else visible', () => {
    expect(formatAmount('2500000')).toBe('$2.50')
    expect(formatAmount('1.5')).toBe('1.5 (atomic units)')
  })
})
