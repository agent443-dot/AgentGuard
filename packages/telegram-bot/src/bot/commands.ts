import { type Bot, type Context, InlineKeyboard } from 'grammy'
import type { Logger } from 'pino'
import type { GuardClient } from '../adapters/guard.js'
import {
  budgetText,
  escapeHtml,
  killedText,
  ownerTransactionText,
  statusText,
} from '../domain/text.js'
import type { Desk } from './desk.js'

export interface CommandDeps {
  guard: GuardClient
  desk: Desk
  log: Logger
}

const HTML = { parse_mode: 'HTML' } as const

const AGENT_ID = /^\S{1,64}$/

const KILL_WARNING =
  '<b>Kill switch.</b> This pauses every agent and prepares, for each chain, the owner transaction ' +
  'that sets the allowance to 0 and removes the delegate. Continue?'

export function registerCommands(bot: Bot, { guard, desk, log }: CommandDeps): void {
  /** A command that cannot reach guard-core says so instead of going quiet. */
  async function guarded(ctx: Context, work: () => Promise<void>) {
    try {
      await work()
    } catch (err) {
      log.error({ err }, 'command failed')
      await ctx.reply('guard-core did not answer. Nothing changed: try again.')
    }
  }

  bot.command('status', (ctx) =>
    guarded(ctx, async () => {
      const pending = desk.book.open().map((entry) => entry.request)
      await ctx.reply(statusText(await guard.healthy(), pending), HTML)
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

  bot.command('kill', (ctx) =>
    ctx.reply(KILL_WARNING, {
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

  bot.callbackQuery('kill:confirm', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Killing…' })
    log.warn({ owner: ctx.from.id }, 'kill switch pressed')
    try {
      const { pausedAgents, ownerTransactions } = await guard.kill()
      await ctx.editMessageText(killedText(pausedAgents, ownerTransactions.length), HTML)
      for (const tx of ownerTransactions) {
        await ctx.reply(ownerTransactionText(tx), HTML)
      }
    } catch (err) {
      log.error({ err }, 'kill failed')
      await ctx.editMessageText(
        '<b>Kill failed</b>: guard-core did not confirm. Assume nothing is paused and run /kill again.',
        HTML,
      )
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
