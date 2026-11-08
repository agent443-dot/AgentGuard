import { getAddress } from '@agentguard/shared'
import { getAddress as checksum, isAddress, type Address, type Chain } from 'viem'
import { base, baseSepolia, robinhood, robinhoodTestnet } from 'viem/chains'
import { z } from 'zod'

const address = z.string().refine((value) => isAddress(value), 'not an EVM address')
const optionalAddress = address.optional().or(z.literal(''))
const privateKey = z.string().regex(/^0x[0-9a-fA-F]{64}$/)
const optionalKey = privateKey.optional().or(z.literal(''))

export const evmConfigSchema = z.object({
  BASE_CHAIN_ID: z.enum(['84532', '8453']).default('84532'),
  BASE_RPC_URL: z.url(),
  // `key` signs as the owner with OWNER_PRIVATE_KEY, testnets only. `ledger` signs on the device at
  // OWNER_LEDGER_PATH, while EXECUTOR_PRIVATE_KEY, which owns nothing, pays the gas.
  OWNER_SIGNER: z.enum(['key', 'ledger']).default('key'),
  // Keys are read from .env, never from the command line, where they would land in shell history.
  OWNER_PRIVATE_KEY: optionalKey,
  OWNER_LEDGER_PATH: z
    .string()
    .regex(/^44'\/60'(\/\d+'?)*$/)
    .default("44'/60'/0'/0/0"),
  EXECUTOR_PRIVATE_KEY: optionalKey,
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
  const config = parsed.data
  if (config.OWNER_SIGNER === 'key' && !config.OWNER_PRIVATE_KEY) {
    throw new Error('invalid base configuration: OWNER_PRIVATE_KEY')
  }
  if (config.OWNER_SIGNER === 'ledger' && !config.EXECUTOR_PRIVATE_KEY) {
    throw new Error('invalid base configuration: EXECUTOR_PRIVATE_KEY')
  }
  // The owner key controls the Safe. A raw key in a file is acceptable on a testnet; on mainnet it
  // has to be on hardware.
  if (config.BASE_CHAIN_ID === '8453' && config.OWNER_SIGNER !== 'ledger') {
    throw new Error(
      'refusing Base mainnet: the Safe owner signs with a raw OWNER_PRIVATE_KEY, and mainnet needs a hardware owner signer (OWNER_SIGNER=ledger)',
    )
  }
  return config
}

/** The EVM chains the adapter serves, by numeric id. */
export type EvmChainId = '84532' | '8453' | '46630' | '4663'

const CHAINS_BY_ID: Record<EvmChainId, Chain> = {
  '84532': baseSepolia,
  '8453': base,
  '46630': robinhoodTestnet,
  '4663': robinhood,
}

export function chainOf(id: EvmChainId): Chain {
  return CHAINS_BY_ID[id]
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
  const verified = getAddress(caip2(config), key === 'usdc' ? 'usd' : key)
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
