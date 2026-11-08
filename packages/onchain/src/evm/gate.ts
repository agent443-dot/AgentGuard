import type { RejectCode } from '@agentguard/shared'
import { getAddress, isAddressEqual, type Address, type Hex } from 'viem'

/** The one payment the hot wallet signs on EVM: an EIP-3009 authorization for exactly this. */
export interface ExpectedAuthorization {
  chainId: number
  usdc: Address
  /** The token's own EIP-712 domain name and version (evm/tokens.ts). */
  domain: { name: string; version: string }
  from: Address
  to: Address
  value: bigint
  /** Unix seconds, passed in so the check stays pure. */
  now: bigint
}

// Longer than any x402 server needs to settle, short enough that a signature leaked from a log is
// worthless by the time anyone reads it.
const MAX_VALIDITY_SECONDS = 3600n

// USDC's own definition (EIP-3009). Different field types would hash to a different message, which
// USDC would reject, but a message that is not this one is not ours to sign either.
const TRANSFER_WITH_AUTHORIZATION = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' },
  { name: 'validBefore', type: 'uint256' },
  { name: 'nonce', type: 'bytes32' },
] as const

/** What the x402 SDK hands its signer: loosely typed, so nothing in it is trusted yet. */
export interface TypedDataRequest {
  domain: Record<string, unknown>
  types: Record<string, unknown>
  primaryType: string
  message: Record<string, unknown>
}

export interface Authorization {
  domain: { name: string; version: string; chainId: number; verifyingContract: Address }
  types: { TransferWithAuthorization: typeof TRANSFER_WITH_AUTHORIZATION }
  primaryType: 'TransferWithAuthorization'
  message: {
    from: Address
    to: Address
    value: bigint
    validAfter: bigint
    validBefore: bigint
    nonce: Hex
  }
}

/**
 * Reads the typed data the x402 client asks the hot wallet to sign. Returns the reasons not to, or
 * the authorization rebuilt from the checked values alone, which is what then gets signed.
 *
 * Any other typed data is a standing grant: Permit and Permit2 let someone else move the tokens
 * later, which is exactly the attack a payment must never carry. Default deny.
 */
export function checkTypedData(
  typed: TypedDataRequest,
  expected: ExpectedAuthorization,
): RejectCode[] | Authorization {
  if (typed.primaryType !== 'TransferWithAuthorization') {
    return ['PERMIT_DETECTED']
  }
  if (
    JSON.stringify(typed.types['TransferWithAuthorization']) !==
    JSON.stringify(TRANSFER_WITH_AUTHORIZATION)
  ) {
    return ['SIM_UNEXPECTED_EFFECT']
  }
  const { domain, message } = typed
  const validAfter = toBigInt(message['validAfter'])
  const validBefore = toBigInt(message['validBefore'])
  const nonce = message['nonce']
  const exact =
    domain['name'] === expected.domain.name &&
    domain['version'] === expected.domain.version &&
    sameAddress(domain['verifyingContract'], expected.usdc) &&
    Number(domain['chainId']) === expected.chainId &&
    sameAddress(message['from'], expected.from) &&
    sameAddress(message['to'], expected.to) &&
    toBigInt(message['value']) === expected.value &&
    typeof nonce === 'string' &&
    /^0x[0-9a-fA-F]{64}$/.test(nonce) &&
    validAfter !== undefined &&
    validAfter <= expected.now &&
    validBefore !== undefined &&
    validBefore > expected.now &&
    validBefore - expected.now <= MAX_VALIDITY_SECONDS
  if (!exact) {
    return ['SIM_UNEXPECTED_EFFECT']
  }
  return {
    domain: {
      name: expected.domain.name,
      version: expected.domain.version,
      chainId: expected.chainId,
      verifyingContract: expected.usdc,
    },
    types: { TransferWithAuthorization: TRANSFER_WITH_AUTHORIZATION },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: getAddress(expected.from),
      to: getAddress(expected.to),
      value: expected.value,
      validAfter,
      validBefore,
      nonce: nonce as Hex,
    },
  }
}

function sameAddress(value: unknown, expected: Address): boolean {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)
    ? isAddressEqual(value as Address, expected)
    : false
}

function toBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') {
    return value
  }
  if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) {
    return BigInt(value)
  }
  return undefined
}
