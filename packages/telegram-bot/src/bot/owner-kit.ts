import type { CallbackQueryContext, Context } from 'grammy'
import type { Logger } from 'pino'
import { escapeHtml } from '../domain/text.js'

export type Press = (ctx: CallbackQueryContext<Context>) => Promise<void>

export const HTML = { parse_mode: 'HTML' } as const

const AGENT_ID = /^\S{1,64}$/

/** A command that cannot reach guard-core says so instead of going quiet. */
export async function guarded(ctx: Context, log: Logger, work: () => Promise<void>) {
  try {
    await work()
  } catch (err) {
    log.error({ err }, 'owner command failed')
    await ctx.reply('guard-core did not answer. Nothing changed: try again.')
  }
}

/** The words after the command, split on whitespace. */
export function args(ctx: Context): string[] {
  return typeof ctx.match === 'string' ? ctx.match.trim().split(/\s+/).filter(Boolean) : []
}

export const validAgent = (id: string | undefined): id is string =>
  id !== undefined && AGENT_ID.test(id)

export const code = (text: string) => `<code>${escapeHtml(text)}</code>`
