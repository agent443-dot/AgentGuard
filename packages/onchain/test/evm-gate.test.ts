import { describe, expect, it } from 'vitest'
import { checkTypedData, type TypedDataRequest } from '../src/evm/gate.js'

const usdc = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const hot = '0x1111111111111111111111111111111111111111'
const merchant = '0x2222222222222222222222222222222222222222'
const now = 1_800_000_000n
const expected = {
  chainId: 84532,
  usdc,
  domain: { name: 'USDC', version: '2' },
  from: hot,
  to: merchant,
  value: 1_000_000n,
  now,
} as const

const fields = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' },
  { name: 'validBefore', type: 'uint256' },
  { name: 'nonce', type: 'bytes32' },
]

// The shape @x402/evm's createEIP3009Payload asks its signer for.
const authorization = (
  message: Record<string, unknown> = {},
  domain: Record<string, unknown> = {},
): TypedDataRequest => ({
  domain: { name: 'USDC', version: '2', chainId: 84532, verifyingContract: usdc, ...domain },
  types: { TransferWithAuthorization: fields },
  primaryType: 'TransferWithAuthorization',
  message: {
    from: hot,
    to: merchant,
    value: 1_000_000n,
    validAfter: 0n,
    validBefore: now + 60n,
    nonce: `0x${'ab'.repeat(32)}`,
    ...message,
  },
})

describe('checkTypedData signs', () => {
  it('the exact authorization, rebuilt from the checked values', () => {
    const checked = checkTypedData(authorization(), expected)
    expect(checked).toMatchObject({
      primaryType: 'TransferWithAuthorization',
      domain: { chainId: 84532, verifyingContract: usdc },
      message: { from: hot, to: merchant, value: 1_000_000n, validBefore: now + 60n },
    })
  })

  it('values given as decimal strings', () => {
    const strings = authorization({
      value: '1000000',
      validAfter: '0',
      validBefore: `${now + 60n}`,
    })
    expect(Array.isArray(checkTypedData(strings, expected))).toBe(false)
  })
})

describe('checkTypedData refuses a standing grant', () => {
  it.each([['Permit'], ['PermitWitnessTransferFrom'], ['PermitSingle'], ['Mail']])(
    '%s',
    (primaryType) => {
      expect(checkTypedData({ ...authorization(), primaryType }, expected)).toEqual([
        'PERMIT_DETECTED',
      ])
    },
  )
})

describe('checkTypedData refuses an authorization that is not the one agreed', () => {
  it.each([
    ['more value', authorization({ value: 1_000_001n })],
    ['another recipient', authorization({ to: hot })],
    ['another payer', authorization({ from: merchant })],
    ['another token', authorization({}, { verifyingContract: merchant })],
    ['another chain', authorization({}, { chainId: 8453 })],
    ['a validity past one hour', authorization({ validBefore: now + 3601n })],
    ['an expired authorization', authorization({ validBefore: now })],
    ['one valid only later', authorization({ validAfter: now + 1n })],
    ['a malformed nonce', authorization({ nonce: '0x01' })],
    ['a negative value as text', authorization({ value: '-1' })],
    ['no domain name', authorization({}, { name: 7 })],
    // The server picks name and version; only the token's own are signed over.
    ['another token name', authorization({}, { name: 'USD Coin' })],
    ['another domain version', authorization({}, { version: '1' })],
    [
      'redefined field types',
      {
        ...authorization(),
        types: {
          TransferWithAuthorization: [...fields.slice(0, 5), { name: 'nonce', type: 'uint256' }],
        },
      },
    ],
  ])('%s', (_case, typed) => {
    expect(checkTypedData(typed, expected)).toEqual(['SIM_UNEXPECTED_EFFECT'])
  })
})
