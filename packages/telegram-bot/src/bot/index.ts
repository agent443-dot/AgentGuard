import { Bot, type BotConfig, type Context } from 'grammy'
import type { Logger } from 'pino'
import type { GuardClient } from '../adapters/guard.js'
import type { PhantomKill } from '../domain/phantom.js'
import type { ReportSchedule } from '../domain/report.js'
import { registerCommands } from './commands.js'
import { Desk } from './desk.js'

export interface BotDeps {
  token: string
  owners: ReadonlySet<number>
  guard: GuardClient
  notifyAbove: bigint
  log: Logger
  now?: () => Date
  /** Tests pass botInfo so the bot never calls getMe. */
  botConfig?: BotConfig<Context>
  /** The onchain kill of each chain; no Phantom button without one. */
  phantomKills?: PhantomKill[]
  /** When the weekly report goes out; none without one. */
  weekly?: ReportSchedule
}

const DECISION = /^(approve|reject):([0-9a-f-]{36})$/
const RECIPIENT = /^recipient:([0-9a-f-]{36})$/

export function createBot({
  token,
  owners,
  guard,
  notifyAbove,
  log,
  now,
  botConfig,
  phantomKills,
  weekly,
}: BotDeps) {
  const bot = new Bot(token, botConfig)
  const desk = new Desk({ api: bot.api, owners, guard, notifyAbove, log, now })

  // Anyone who is not an owner gets no reply at all: even an error tells them the bot is listening.
  bot.use(async (ctx, next) => {
    if (ctx.from !== undefined && owners.has(ctx.from.id)) {
      await next()
    }
  })

  bot.callbackQuery(DECISION, async (ctx) => {
    const [, action, intentId] = ctx.match
    const message = ctx.callbackQuery.message
    if (intentId === undefined || message === undefined) {
      return ctx.answerCallbackQuery()
    }
    const text = await desk.decide(
      intentId,
      action === 'approve' ? 'approve' : 'reject',
      ctx.from,
      {
        chatId: message.chat.id,
        messageId: message.message_id,
        text: 'text' in message ? (message.text ?? '') : '',
      },
    )
    await ctx.answerCallbackQuery({ text })
  })

  bot.callbackQuery(RECIPIENT, (ctx) =>
    ctx.answerCallbackQuery({ text: desk.recipient(ctx.match[1] ?? ''), show_alert: true }),
  )

  const commands = registerCommands(bot, { guard, desk, log, phantomKills, weekly, now })

  bot.catch(({ error }) => log.error({ err: error }, 'update failed'))

  return { bot, desk, commands }
}
