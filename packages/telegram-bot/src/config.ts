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

/**
 * A page the bot links to by appending a path or a query: the signing page, whose origin also goes to
 * Phantom as the ref, and guard-core's passkey page. A query or fragment of its own would corrupt it.
 */
// One check that cannot throw: zod runs a refine even on input an earlier check already refused.
const httpsPage = z.string().refine((value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.search === '' && url.hash === ''
  } catch {
    return false
  }
}, 'expected an https url with no query or fragment')

const solanaKey = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'expected a base58 public key')
const evmAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'expected a 0x address')

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
      .regex(/^(0|[1-9]\d*)$/, 'expected dollar atomic units')
      .default('1000000')
      .transform(BigInt),

    // The onchain kill on the signing page (ADR 003). Without SIGN_PAGE_URL there is no button.
    SIGN_PAGE_URL: optional(httpsPage),
    SOLANA_CHAIN: z.enum([CHAINS.solanaDevnet, CHAINS.solanaMainnet]).default(CHAINS.solanaDevnet),
    SQUADS_MULTISIG: optional(solanaKey),
    SOLANA_HOT_WALLET_PUBKEY: optional(solanaKey),
    ROBINHOOD_CHAIN: z
      .enum([CHAINS.robinhoodTestnet, CHAINS.robinhood])
      .default(CHAINS.robinhoodTestnet),
    // guard-core's public page, where an owner approves with a passkey.
    GUARD_PUBLIC_URL: optional(httpsPage),
    // The weekly report: both, or neither for no weekly report. 0 is Sunday.
    REPORT_WEEKDAY: optional(z.coerce.number().int().min(0).max(6)),
    REPORT_HOUR_UTC: optional(z.coerce.number().int().min(0).max(23)),
    // The page takes the Robinhood hot wallet from its own build, so the link names only the Safe.
    ROBINHOOD_SAFE_ADDRESS: optional(evmAddress),
  })
  // A kill link that names no multisig or hot wallet opens a page that can only refuse it. With the
  // page set, each chain is configured completely or not at all, and at least one chain is.
  .superRefine((config, ctx) => {
    if ((config.REPORT_WEEKDAY === undefined) !== (config.REPORT_HOUR_UTC === undefined)) {
      const missing = config.REPORT_WEEKDAY === undefined ? 'REPORT_WEEKDAY' : 'REPORT_HOUR_UTC'
      ctx.addIssue({ code: 'custom', path: [missing], message: 'set both or neither' })
    }
    if (config.SIGN_PAGE_URL === undefined) {
      return
    }
    const solana = ['SQUADS_MULTISIG', 'SOLANA_HOT_WALLET_PUBKEY'] as const
    const unset = (key: keyof typeof config) => config[key] === undefined
    const missing = !solana.every(unset)
      ? solana.filter(unset)
      : unset('ROBINHOOD_SAFE_ADDRESS')
        ? [...solana, 'ROBINHOOD_SAFE_ADDRESS']
        : []
    for (const key of missing) {
      ctx.addIssue({ code: 'custom', path: [key], message: 'required with SIGN_PAGE_URL' })
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
