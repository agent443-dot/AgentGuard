import { z } from 'zod'
import { toBaseUnits } from './amount.js'
import { WizardError } from './errors.js'
import { NETWORK_IDS, type Family } from './networks.js'

/** D1: no cap above 50 of the chain's dollar, the same ceiling the signing page enforces. */
export const MAX_CAP = 50_000_000n

export const prefixSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]{0,28}[a-z0-9]$/,
    'use 2 to 30 lowercase letters, digits and dashes, starting with a letter',
  )
  .refine((value) => !value.includes('--'), 'no double dashes')

export const orgSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,62}$/, 'a Fly organization slug, like personal')

export const regionSchema = z
  .string()
  .regex(/^[a-z]{3}$/, 'a Fly region is three letters, like gru or iad')

export const agentIdSchema = z
  .string()
  .regex(/^[\w-]{1,64}$/, 'use up to 64 letters, digits, dashes and underscores')

export const telegramTokenSchema = z
  .string()
  .regex(/^\d+:[\w-]+$/, 'expected the token from @BotFather, like 123456:ABC-def')

// Above 2^53 an id would round to someone else's, as the bot's own config refuses.
const telegramId = z
  .string()
  .regex(/^[1-9]\d*$/, 'a Telegram user id is a positive number')
  .refine((id) => Number.isSafeInteger(Number(id)), 'that number is too large for a Telegram id')

export const ownerIdsSchema = z
  .string()
  .transform((value) => value.split(',').map((id) => id.trim()))
  .pipe(z.array(telegramId).min(1))
  .transform((ids) => ids.join(','))

export const httpsUrlSchema = z.string().refine((value) => {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}, 'expected an https:// URL')

export const capSchema = z
  .string()
  .transform((value, ctx) => {
    try {
      return toBaseUnits(value)
    } catch {
      ctx.addIssue({ code: 'custom', message: 'expected an amount in dollars, like 20' })
      return z.NEVER
    }
  })
  .refine((units) => units > 0n && units <= MAX_CAP, 'the cap must be above 0 and at most 50')
  .transform((units) => units.toString())

export const presetSchema = z.enum(['careful', 'standard'])
export type Preset = z.infer<typeof presetSchema>

export const familiesSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.enum(['solana', 'robinhood', 'both']))
  .transform((choice): Family[] => (choice === 'both' ? ['solana', 'robinhood'] : [choice]))

const network = z.enum(NETWORK_IDS)

/** Everything the wizard asks that is not a secret: what the state file keeps between runs. */
export const answersSchema = z.object({
  prefix: prefixSchema,
  org: orgSchema,
  region: regionSchema,
  networks: z.array(network).min(1),
  /** Each network's onchain daily cap, in base units. */
  caps: z.partialRecord(network, z.string().regex(/^[1-9]\d*$/)),
  preset: presetSchema,
  ownerIds: z.string().min(1),
  agentId: agentIdSchema,
})
export type Answers = z.infer<typeof answersSchema>

/** Parses one typed answer; the message names what is wrong, never the value. */
export function check<T>(schema: z.ZodType<T>, raw: string): T {
  const parsed = schema.safeParse(raw.trim())
  if (!parsed.success) {
    throw new WizardError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'not valid')
  }
  return parsed.data
}

export function yesNo(raw: string, fallback: boolean): boolean {
  const value = raw.trim().toLowerCase()
  if (value === '') {
    return fallback
  }
  if (['y', 'yes'].includes(value)) {
    return true
  }
  if (['n', 'no'].includes(value)) {
    return false
  }
  throw new WizardError('INVALID_INPUT', 'answer yes or no')
}

/** A valid Fly name from the OS user, or a plain fallback when nothing usable is left of it. */
export function defaultPrefix(username: string): string {
  const cleaned = username
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[^a-z]+/, '')
    .slice(0, 30)
    .replace(/-+$/, '')
  return prefixSchema.safeParse(cleaned).success ? cleaned : 'agentguard'
}

export function appNames(prefix: string) {
  return {
    guard: `${prefix}-guard-core`,
    bot: `${prefix}-bot`,
    page: `${prefix}-signing-page`,
  }
}
