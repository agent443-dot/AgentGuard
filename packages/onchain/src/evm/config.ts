import { getAddress } from '@agentguard/shared'
import { getAddress as checksum, isAddress, type Address, type Chain } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { z } from 'zod'

const address = z.string().refine((value) => isAddress(value), 'not an EVM address')
const optionalAddress = address.optional().or(z.literal(''))

export const evmConfigSchema = z.object({
  BASE_CHAIN_ID: z.enum(['84532', '8453']).default('84532'),
  BASE_RPC_URL: z.url(),
  // Testnet only. Read from .env, never from the command line, where it would land in shell history.
  OWNER_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  HOT_WALLET_ADDRESS: address,
  SAFE_ADDRESS: optionalAddress,
  // Until shared/addresses.ts has a verified value for the chain, these must be set; see CR-005.
  BASE_USDC: optionalAddress,
  BASE_ALLOWANCE_MODULE: optionalAddress,
  DAILY_CAP: z.string().regex(/^(0|[1-9]\d*)$/),
})

export type EvmConfig = z.infer<typeof evmConfigSchema>

export function loadEvmConfig(env: NodeJS.ProcessEnv = process.env): EvmConfig {
  const parsed = evmConfigSchema.safeParse(env)
  if (!parsed.success) {
    // Field names only: one of these is a private key, and its value must never reach a log.
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`invalid base configuration: ${fields}`)
  }
  // The owner key controls the Safe. A raw key in a file is acceptable on a testnet; on mainnet it
  // must be on hardware, and until the scripts can sign with one, they refuse mainnet outright.
  if (parsed.data.BASE_CHAIN_ID === '8453') {
    throw new Error(
      'refusing Base mainnet: the Safe owner signs with a raw OWNER_PRIVATE_KEY, and mainnet needs a hardware owner signer',
    )
  }
  return parsed.data
}

export function chainOf(id: EvmConfig['BASE_CHAIN_ID']): Chain {
  return id === '8453' ? base : baseSepolia
}

export function caip2(config: EvmConfig): string {
  return `eip155:${config.BASE_CHAIN_ID}`
}

/**
 * The verified value in shared/addresses.ts wins. An env value is accepted only where shared has
 * none, and the scripts then check the chain holds code there before trusting it.
 */
export function contractAddress(
  config: EvmConfig,
  key: 'usdc' | 'allowanceModule',
): { address: Address; source: string } {
  const verified = getAddress(caip2(config), key)
  if (verified) {
    return { address: checksum(verified), source: 'shared/addresses.ts' }
  }
  const fromEnv = key === 'usdc' ? config.BASE_USDC : config.BASE_ALLOWANCE_MODULE
  if (!fromEnv) {
    const name = key === 'usdc' ? 'BASE_USDC' : 'BASE_ALLOWANCE_MODULE'
    throw new Error(`no verified ${key} for ${caip2(config)}: set ${name} from the official source`)
  }
  return { address: checksum(fromEnv), source: '.env' }
}
