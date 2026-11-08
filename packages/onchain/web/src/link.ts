import { z } from 'zod'

// A kill link is good for 15 minutes; a few minutes of clock skew either way are forgiven.
const KILL_LINK_TTL_S = 15 * 60
const FUTURE_SLACK_S = 5 * 60

// Unix seconds when the bot made the link. A kill button left in an old message, or kept by a bot
// that restarted, must not remove the limit out of step with guard-core.
export const issued = z
  .string()
  .regex(/^\d{1,12}$/, 'unix seconds')
  .transform(Number)
  .refine((at) => at <= Date.now() / 1000 + FUTURE_SLACK_S, 'issued in the future')

export const expired = (at: number) => Date.now() / 1000 - at > KILL_LINK_TTL_S

export const EXPIRED = 'This link expired. Use /kill in Telegram for a fresh one.'

/** A link that does not parse, as the owner should read it. */
export const problems = (error: z.ZodError) =>
  error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
