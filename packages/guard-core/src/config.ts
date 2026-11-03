import { CHAINS } from '@agentguard/shared'
import { z } from 'zod'

const secret = z.string().min(32, 'use at least 32 characters; generate with openssl rand -hex 32')

export const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1).default('file:./data/guard.db'),

  ADMIN_TOKEN: secret,
  BOT_TOKEN: secret,

  BOT_URL: z.string().min(1),
  BOT_WEBHOOK_SECRET: secret,

  SOLANA_CHAIN: z.enum([CHAINS.solanaDevnet, CHAINS.solanaMainnet]).default(CHAINS.solanaDevnet),
  SOLANA_RPC_URL: z.string().min(1).optional(),
  SOLANA_HOT_WALLET_KEYPAIR: z.string().min(1).optional(),
  SQUADS_MULTISIG: z.string().min(1).optional(),

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
