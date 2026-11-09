import { CHAINS, getAddress as sharedAddress, type ChainId } from '@agentguard/shared'
import { getAddress, isAddress, type Address } from 'viem'
import { z } from 'zod'
import type { EvmChainId } from './config.js'

const address = z.string().refine((value) => isAddress(value), 'not an EVM address')

/**
 * Robinhood Chain settings, under the ROBINHOOD_* names guard-core reads too, so the owner fills
 * one set. There is no owner key here: on Robinhood the owner signs in Phantom, through the signing
 * page (D4), and these scripts only read.
 */
export const robinhoodConfigSchema = z.object({
  ROBINHOOD_CHAIN: z
    .enum([CHAINS.robinhoodTestnet, CHAINS.robinhood])
    .default(CHAINS.robinhoodTestnet),
  ROBINHOOD_RPC_URL: z.url(),
  ROBINHOOD_SAFE_ADDRESS: address,
  // The hot wallet's address only; its key lives in guard-core (ROBINHOOD_HOT_WALLET_KEY_FILE).
  ROBINHOOD_HOT_WALLET_ADDRESS: address,
})

export interface RobinhoodConfig {
  chain: ChainId
  chainId: EvmChainId
  rpcUrl: string
  safe: Address
  hot: Address
  usdg: Address
  module: Address
}

export function loadRobinhoodConfig(env: NodeJS.ProcessEnv = process.env): RobinhoodConfig {
  const parsed = robinhoodConfigSchema.safeParse(env)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`invalid robinhood configuration: ${fields}`)
  }
  const chain = parsed.data.ROBINHOOD_CHAIN
  // Both come from shared, verified on the chain; there is no .env override on Robinhood.
  const usdg = sharedAddress(chain, 'usd')
  const module = sharedAddress(chain, 'allowanceModule')
  if (!usdg || !module) {
    throw new Error(`shared/addresses.ts has no USDG or Allowance Module for ${chain}`)
  }
  return {
    chain,
    chainId: chain === CHAINS.robinhood ? '4663' : '46630',
    rpcUrl: parsed.data.ROBINHOOD_RPC_URL,
    safe: getAddress(parsed.data.ROBINHOOD_SAFE_ADDRESS),
    hot: getAddress(parsed.data.ROBINHOOD_HOT_WALLET_ADDRESS),
    usdg: getAddress(usdg),
    module: getAddress(module),
  }
}
