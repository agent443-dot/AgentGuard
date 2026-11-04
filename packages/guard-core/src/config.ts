import { CHAINS } from '@agentguard/shared'
import { z } from 'zod'

const secret = z.string().min(32, 'use at least 32 characters; generate with openssl rand -hex 32')

// `KEY=` in a .env file means unset, as the .env.example files leave it.
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional())
}

const evmAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'expected a 0x address')

export const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  /** Loopback unless set: a deployment opts in to listening beyond this machine. */
  HOST: z.union([z.ipv4(), z.ipv6(), z.hostname()]).default('127.0.0.1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1).default('file:./data/guard.db'),

  ADMIN_TOKEN: secret,
  BOT_TOKEN: secret,

  BOT_URL: z.string().min(1),
  BOT_WEBHOOK_SECRET: secret,

  SOLANA_CHAIN: z.enum([CHAINS.solanaDevnet, CHAINS.solanaMainnet]).default(CHAINS.solanaDevnet),
  SOLANA_RPC_URL: optional(z.string().min(1)),
  SOLANA_HOT_WALLET_KEYPAIR: optional(z.string().min(1)),
  SQUADS_MULTISIG: optional(z.string().min(1)),

  /** Base is off unless this names the chain; then every value below must be present. */
  BASE_CHAIN: optional(z.enum([CHAINS.baseSepolia, CHAINS.base])),
  BASE_RPC_URL: optional(z.url()),
  SAFE_ADDRESS: optional(evmAddress),
  HOT_WALLET_PRIVATE_KEY: optional(z.string().regex(/^0x[0-9a-fA-F]{64}$/)),
  /** Only where shared/addresses.ts has no verified value for the chain yet (CR-005). */
  BASE_USDC: optional(evmAddress),
  BASE_ALLOWANCE_MODULE: optional(evmAddress),

  /** Offline chains that move no money. For local development only. */
  GUARD_STUB_CHAINS: z.enum(['true', 'false']).default('false'),
  EXPIRY_SWEEP_MS: z.coerce.number().int().positive().default(30_000),
})

export type Config = z.infer<typeof configSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env)
  if (!parsed.success) {
    // Names only. The values are secrets and this runs at startup, often into a shared log.
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`invalid configuration: ${fields}`)
  }
  return parsed.data
}
