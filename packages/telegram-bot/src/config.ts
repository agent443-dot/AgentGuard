import { CHAINS } from '@agentguard/shared'
import { z } from 'zod'

const secret = z.string().min(32, 'use at least 32 characters; generate with openssl rand -hex 32')

/**
 * Who may approve payments and press kill, so any doubt refuses to start. Above 2^53 Number() rounds,
 * and a rounded id can be someone else's: those are refused rather than converted.
 */
const telegramId = z
  .string()
  .regex(/^[1-9]\d*$/, 'expected a positive integer Telegram user id')
  .transform(Number)
  .refine(Number.isSafeInteger, 'Telegram user id out of range')

const telegramIds = z
  .string()
  .transform((value) => value.split(',').map((id) => id.trim()))
  .pipe(z.array(telegramId).min(1))
  .transform((ids) => new Set(ids))

/** An empty line in .env means unset, not an empty value. */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional())
}

/** Its own origin goes to Phantom as the ref, and a query would be read as part of the kill link. */
// One check that cannot throw: zod runs a refine even on input an earlier check already refused.
const signPage = z.string().refine((value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.search === '' && url.hash === ''
  } catch {
    return false
  }
}, 'expected an https url with no query or fragment')

const solanaKey = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'expected a base58 public key')

export const configSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(8788),
    HOST: z.string().min(1).default('127.0.0.1'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/, 'expected a token from BotFather'),
    OWNER_TELEGRAM_IDS: telegramIds,

    GUARD_URL: z.url(),
    GUARD_BOT_TOKEN: secret,
    GUARD_ADMIN_TOKEN: secret,
    BOT_WEBHOOK_SECRET: secret,

    HOOK_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),

    NOTIFY_ABOVE_AMOUNT: z
      .string()
      .regex(/^(0|[1-9]\d*)$/, 'expected USDC atomic units')
      .default('1000000')
      .transform(BigInt),

    // The onchain kill on the signing page (ADR 003). Without SIGN_PAGE_URL there is no button.
    SIGN_PAGE_URL: optional(signPage),
    SOLANA_CHAIN: z.enum([CHAINS.solanaDevnet, CHAINS.solanaMainnet]).default(CHAINS.solanaDevnet),
    SQUADS_MULTISIG: optional(solanaKey),
    SOLANA_HOT_WALLET_PUBKEY: optional(solanaKey),
  })
  // A kill link that names no multisig or hot wallet opens a page that can only refuse it.
  .superRefine((config, ctx) => {
    if (config.SIGN_PAGE_URL === undefined) {
      return
    }
    for (const key of ['SQUADS_MULTISIG', 'SOLANA_HOT_WALLET_PUBKEY'] as const) {
      if (config[key] === undefined) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'required with SIGN_PAGE_URL' })
      }
    }
  })

export type Config = z.infer<typeof configSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env)
  if (!parsed.success) {
    // Names only: the values are secrets.
    const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0])))
    throw new Error(`invalid configuration: ${[...fields].join(', ')}`)
  }
  return parsed.data
}
