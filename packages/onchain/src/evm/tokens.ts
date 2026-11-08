import { CHAINS, type ChainId } from '@agentguard/shared'
import { parseAbi } from 'viem'

/**
 * The EIP-712 domain of each chain's dollar token, which an EIP-3009 authorization must carry
 * exactly. The x402 server chooses these values in its payment requirements, so the hot wallet
 * signs only the token's own: a different name or version is a signature over some other contract's
 * domain. The forge tests check every entry against the chain's DOMAIN_SEPARATOR.
 */
export const TOKEN_DOMAINS: Partial<Record<ChainId, { name: string; version: string }>> = {
  // Circle's USDC: forge/TokenDomains.t.sol on Base mainnet and Sepolia forks.
  [CHAINS.base]: { name: 'USD Coin', version: '2' },
  [CHAINS.baseSepolia]: { name: 'USDC', version: '2' },
  // Paxos's USDG: forge/RobinhoodProbe.t.sol, and ClaimableRewardsBase.sol in paxos-token-contracts.
  [CHAINS.robinhood]: { name: 'Global Dollar', version: '1' },
  [CHAINS.robinhoodTestnet]: { name: 'Global Dollar', version: '1' },
}

/** The token reverts a payment can hit, so a failed simulation says why in words. */
export const tokenErrorsAbi = parseAbi([
  'error Error(string reason)',
  'error AddressFrozen()',
  'error ContractPaused()',
  'error InsufficientFunds()',
  'error InvalidSignature()',
  'error AuthorizationExpired()',
  'error AuthorizationInvalid()',
  'error ZeroAddress()',
])

export const TOKEN_ERRORS: Record<string, string> = {
  AddressFrozen: 'the token issuer has frozen an address in this payment (AddressFrozen)',
  ContractPaused: 'the token issuer has paused the token (ContractPaused)',
  InsufficientFunds: 'the sender does not hold enough of the token (InsufficientFunds)',
  InvalidSignature: 'the token rejected the signature (InvalidSignature)',
  AuthorizationExpired: 'the authorization has expired (AuthorizationExpired)',
  AuthorizationInvalid: 'the authorization is not valid yet (AuthorizationInvalid)',
  ZeroAddress: 'the payment names the zero address (ZeroAddress)',
}
