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

export const configSchema = z.object({
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
