import { type Bot, type CallbackQueryContext, type Context, InlineKeyboard } from 'grammy'
import type { Logger } from 'pino'
import type { GuardClient } from '../adapters/guard.js'
import {
  budgetText,
  escapeHtml,
  isBuilt,
  killedText,
  ownerTransactionText,
  statusText,
} from '../domain/text.js'
import {
  chainsText,
  KILL_FAILED,
  KILL_FAILED_ONCHAIN,
  KILL_OFFER_EXPIRED,
  killWarning,
  PHANTOM_ANYWAY,
} from '../domain/chains.js'
import { type KillOffer, KillOffers } from '../domain/kill-offers.js'
import type { Desk } from './desk.js'

export interface CommandDeps {
  guard: GuardClient
  desk: Desk
  log: Logger
  /** Builds the onchain kill link on the signing page, when SIGN_PAGE_URL is configured. */
  phantomKill?: (issued: Date) => string
  now?: () => Date
}

const HTML = { parse_mode: 'HTML' } as const

const AGENT_ID = /^\S{1,64}$/

export function registerCommands(
  bot: Bot,
  { guard, desk, log, phantomKill, now = () => new Date() }: CommandDeps,
) {
  const phantom = phantomKill !== undefined
  const offers = new KillOffers()

  /** Drops the button and says so, keeping what the message told the owner. */
  async function retire(stale: KillOffer[]) {
    for (const offer of stale) {
      await bot.api
        .editMessageText(
          offer.chatId,
          offer.messageId,
          `${offer.text}\n${KILL_OFFER_EXPIRED}`,
          HTML,
        )
        .catch((err: unknown) => log.warn({ err }, 'kill offer retire failed'))
    }
  }

  /** A command that cannot reach guard-core says so instead of going quiet. */
  async function guarded(ctx: Context, work: () => Promise<void>) {
    try {
      await work()
    } catch (err) {
      log.error({ err }, 'command failed')
      await ctx.reply('guard-core did not answer. Nothing changed: try again.')
    }
  }

  /** Best effort: a chain list that fails to load must not hide the rest of /status or /kill. */
  async function chains() {
    try {
      return await guard.chains()
    } catch (err) {
      log.warn({ err }, 'chain list failed')
      return undefined
    }
  }

  bot.command('status', (ctx) =>
    guarded(ctx, async () => {
      const pending = desk.book.open().map((entry) => entry.request)
      const up = await guard.healthy()
      const text = statusText(up, pending)
      await ctx.reply(up ? `${text}\n${chainsText(await chains())}` : text, HTML)
    }),
  )

  bot.command('budget', (ctx) =>
    withAgent(ctx, 'budget', (agentId) =>
      guarded(ctx, async () => {
        const budget = await guard.budget(agentId)
        await ctx.reply(
          budget === undefined ? unknownAgent(agentId) : budgetText(agentId, budget),
          HTML,
        )
      }),
    ),
  )

  for (const [command, paused] of [
    ['pause', true],
    ['resume', false],
  ] as const) {
    bot.command(command, (ctx) =>
      withAgent(ctx, command, (agentId) =>
        guarded(ctx, async () => {
          const result = await guard.setPaused(agentId, paused)
          log.info({ agentId, paused, result, owner: ctx.from?.id }, 'pause command')
          await ctx.reply(
            result === 'ok' ? pausedText(agentId, paused) : unknownAgent(agentId),
            HTML,
          )
        }),
      ),
    )
  }

  bot.command('kill', async (ctx) =>
    ctx.reply(killWarning(await chains(), phantom), {
      ...HTML,
      reply_markup: new InlineKeyboard()
        .text('Kill everything', 'kill:confirm')
        .text('Cancel', 'kill:cancel'),
    }),
  )

  bot.callbackQuery('kill:cancel', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Cancelled' })
    await ctx.editMessageText('Kill cancelled. Nothing changed.')
  })

  /**
   * Edits the kill message to text and, when the signing page is configured, a Phantom button with
   * label. The button becomes the only live one: older ones are retired, and it expires on its own.
   */
  async function offerKill(ctx: CallbackQueryContext<Context>, text: string, label: string) {
    const message = ctx.callbackQuery.message
    if (phantomKill === undefined || message === undefined) {
      await ctx.editMessageText(text, HTML)
      return
    }
    const at = now()
    await ctx.editMessageText(text, {
      ...HTML,
      reply_markup: new InlineKeyboard().url(label, phantomKill(at)),
    })
    const offer = {
      chatId: message.chat.id,
      messageId: message.message_id,
      text,
      at: at.getTime(),
    }
    await retire(offers.offer(offer))
  }

  bot.callbackQuery('kill:confirm', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Killing…' })
    log.warn({ owner: ctx.from.id }, 'kill switch pressed')
    let result: Awaited<ReturnType<GuardClient['kill']>>
    try {
      result = await guard.kill()
    } catch (err) {
      log.error({ err }, 'kill failed')
      // guard-core may be down, so the onchain limit is the only brake left; the label says so.
      await offerKill(ctx, phantom ? KILL_FAILED_ONCHAIN : KILL_FAILED, PHANTOM_ANYWAY)
      return
    }
    const built = result.ownerTransactions.filter(isBuilt).length
    await offerKill(ctx, killedText(result.pausedAgents, built, phantom), 'Open kill in Phantom')
    for (const tx of result.ownerTransactions) {
      await ctx.reply(ownerTransactionText(tx), HTML)
    }
  })

  /** Runs on the bot's sweep timer: a button nobody pressed in time stops working. */
  return { expireKillOffers: () => retire(offers.expired(now())) }
}

async function withAgent(ctx: Context, command: string, run: (agentId: string) => Promise<void>) {
  const agentId = typeof ctx.match === 'string' ? ctx.match.trim() : ''
  if (!AGENT_ID.test(agentId)) {
    await ctx.reply(`Usage: /${command} &lt;agentId&gt;`, HTML)
    return
  }
  await run(agentId)
}

function unknownAgent(agentId: string): string {
  return `No agent <code>${escapeHtml(agentId)}</code>.`
}

function pausedText(agentId: string, paused: boolean): string {
  const id = `<code>${escapeHtml(agentId)}</code>`
  return paused
    ? `Paused ${id}. Its payments are refused until /resume ${id}.`
    : `Resumed ${id}. Its payments go through the policy again.`
}
