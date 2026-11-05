import { type Bot, type Context, InlineKeyboard } from 'grammy'
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
import { chainsText, killWarning, PHANTOM_STEP } from '../domain/chains.js'
import type { Desk } from './desk.js'

export interface CommandDeps {
  guard: GuardClient
  desk: Desk
  log: Logger
  /** The onchain kill on the signing page, when SIGN_PAGE_URL is configured. */
  phantomKill?: string
}

const HTML = { parse_mode: 'HTML' } as const

const AGENT_ID = /^\S{1,64}$/

export function registerCommands(bot: Bot, { guard, desk, log, phantomKill }: CommandDeps): void {
  const phantom = phantomKill !== undefined

  function phantomButton(keyboard = new InlineKeyboard()) {
    return phantomKill === undefined
      ? keyboard
      : keyboard.row().url('Open kill in Phantom', phantomKill)
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
      reply_markup: phantomButton(
        new InlineKeyboard().text('Kill everything', 'kill:confirm').text('Cancel', 'kill:cancel'),
      ),
    }),
  )

  bot.callbackQuery('kill:cancel', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Cancelled' })
    await ctx.editMessageText('Kill cancelled. Nothing changed.')
  })

  bot.callbackQuery('kill:confirm', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Killing…' })
    log.warn({ owner: ctx.from.id }, 'kill switch pressed')
    try {
      const { pausedAgents, ownerTransactions } = await guard.kill()
      const built = ownerTransactions.filter(isBuilt).length
      await ctx.editMessageText(killedText(pausedAgents, built, phantom), {
        ...HTML,
        reply_markup: phantomButton(),
      })
      for (const tx of ownerTransactions) {
        await ctx.reply(ownerTransactionText(tx), HTML)
      }
    } catch (err) {
      log.error({ err }, 'kill failed')
      // guard-core being down is exactly when the onchain kill matters most.
      const failed =
        '<b>Kill failed</b>: guard-core did not confirm. Assume nothing is paused and run /kill again.'
      await ctx.editMessageText(phantom ? `${failed}\n${PHANTOM_STEP}` : failed, {
        ...HTML,
        reply_markup: phantomButton(),
      })
    }
  })
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
