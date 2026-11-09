import { Bot, type BotConfig, type Context } from 'grammy'
import type { Logger } from 'pino'
import type { AdminClient } from '../adapters/admin.js'
import type { GuardClient } from '../adapters/guard.js'
import type { PhantomKill } from '../domain/phantom.js'
import type { ReportSchedule } from '../domain/report.js'
import { registerCommands } from './commands.js'
import { registerOwner } from './owner.js'
import { Desk } from './desk.js'

export interface BotDeps {
  token: string
  owners: ReadonlySet<number>
  guard: GuardClient
  /** Agents, policies and the doctor; left out, the bot has no owner commands for them. */
  admin?: AdminClient
  notifyAbove: bigint
  log: Logger
  now?: () => Date
  /** Tests pass botInfo so the bot never calls getMe. */
  botConfig?: BotConfig<Context>
  /** The onchain kill of each chain; no Phantom button without one. */
  phantomKills?: PhantomKill[]
  /** guard-core's public origin, for the passkey approval link. */
  guardPublicUrl?: string
  /** When the weekly report goes out; none without one. */
  weekly?: ReportSchedule
}

const DECISION = /^(approve|reject):([0-9a-f-]{36})$/
const RECIPIENT = /^recipient:([0-9a-f-]{36})$/
const TASK = /^task-(approve|reject):([0-9a-f-]{36})$/

export function createBot({
  token,
  owners,
  guard,
  admin,
  notifyAbove,
  log,
  now,
  botConfig,
  phantomKills,
  weekly,
  guardPublicUrl,
}: BotDeps) {
  const bot = new Bot(token, botConfig)
  const desk = new Desk({ api: bot.api, owners, guard, notifyAbove, log, now, guardPublicUrl })

  // Anyone who is not an owner gets no reply at all: even an error tells them the bot is listening.
  bot.use(async (ctx, next) => {
    if (ctx.from !== undefined && owners.has(ctx.from.id)) {
      await next()
    }
  })

  // A payment and a task budget are decided the same way, through their own guard-core route.
  for (const [pattern, decide] of [
    [DECISION, desk.decide.bind(desk)],
    [TASK, desk.decideMandate.bind(desk)],
  ] as const) {
    bot.callbackQuery(pattern, async (ctx) => {
      const [, action, id] = ctx.match
      const message = ctx.callbackQuery.message
      if (id === undefined || message === undefined) {
        return ctx.answerCallbackQuery()
      }
      const text = await decide(id, action === 'approve' ? 'approve' : 'reject', ctx.from, {
        chatId: message.chat.id,
        messageId: message.message_id,
        text: 'text' in message ? (message.text ?? '') : '',
      })
      await ctx.answerCallbackQuery({ text })
    })
  }

  bot.callbackQuery(RECIPIENT, (ctx) =>
    ctx.answerCallbackQuery({ text: desk.recipient(ctx.match[1] ?? ''), show_alert: true }),
  )

  const commands = registerCommands(bot, { guard, desk, log, phantomKills, weekly, now })
  const owner =
    admin === undefined
      ? { sweep: async () => {} }
      : registerOwner(bot, { admin, guard, desk, log, now: now ?? (() => new Date()) })

  bot.catch(({ error }) => log.error({ err: error }, 'update failed'))

  return { bot, desk, commands, owner }
}
