import { type Bot, type Context, InlineKeyboard } from 'grammy'
import type { Logger } from 'pino'
import type { AdminClient } from '../adapters/admin.js'
import { Confirms } from '../domain/confirms.js'
import { pages } from '../domain/pages.js'
import { agentsText, doctorBlocks } from '../domain/policy.js'
import type { Desk } from './desk.js'
import { args, code, guarded, HTML, type Press, validAgent } from './owner-kit.js'
import { registerPolicies } from './policies.js'

export interface OwnerDeps {
  admin: AdminClient
  desk: Desk
  log: Logger
  now: () => Date
}

/** The token message is deleted this long after it was sent. */
export const TOKEN_TTL_MS = 60_000

const SETUP = 'npx @agentguard/mcp-server setup claude-code'

/**
 * The owner's daily commands, so nobody needs a terminal: agents, policies, mode and the doctor.
 * Every button carries only a random id; what it does stays here, and works once.
 */
export function registerOwner(bot: Bot, { admin, desk, log, now }: OwnerDeps) {
  const confirms = new Confirms<Press>()
  const tokens: { chatId: number; messageId: number; at: number }[] = []

  const button = (run: Press, ttlMs?: number) => `own:${confirms.add(run, now(), ttlMs)}`
  const cancel = new InlineKeyboard().text('Cancel', 'own:cancel')

  bot.callbackQuery(/^own:(.+)$/, async (ctx) => {
    const id = ctx.match[1] ?? ''
    if (id === 'cancel') {
      await ctx.answerCallbackQuery({ text: 'Cancelled' })
      await ctx.editMessageText('Cancelled. Nothing changed.')
      return
    }
    const run = confirms.take(id, now())
    if (run === undefined) {
      await ctx.answerCallbackQuery({ text: 'This button has expired. Run the command again.' })
      return
    }
    await ctx.answerCallbackQuery()
    await guarded(ctx, log, () => run(ctx))
  })

  bot.command('agent', (ctx) => {
    const [action, agentId] = args(ctx)
    if (action === 'list') {
      return guarded(ctx, log, async () => {
        await ctx.reply(agentsText(await admin.listAgents()), HTML)
      })
    }
    if ((action !== 'new' && action !== 'revoke') || !validAgent(agentId)) {
      return ctx.reply('Usage: /agent new &lt;id&gt;, /agent list, /agent revoke &lt;id&gt;', HTML)
    }
    if (action === 'revoke') {
      const keyboard = new InlineKeyboard()
        .text(
          'Revoke',
          button(async (press) => {
            const done = await admin.revokeAgent(agentId)
            log.warn({ agentId, owner: press.from.id, done }, 'agent revoked')
            await press.editMessageText(
              done
                ? `Revoked ${code(agentId)}. Its token stops working at its next request.`
                : `No agent ${code(agentId)}.`,
              HTML,
            )
          }),
        )
        .text('Cancel', 'own:cancel')
      return ctx.reply(`Revoke ${code(agentId)}? Its token stops working for good.`, {
        ...HTML,
        reply_markup: keyboard,
      })
    }
    return guarded(ctx, log, async () => {
      const created = await admin.createAgent(agentId)
      if (created === undefined) {
        await ctx.reply(`An agent ${code(agentId)} already exists.`, HTML)
        return
      }
      log.info({ agentId, owner: ctx.from?.id }, 'agent created')
      await ctx.reply(
        `Created ${code(agentId)} in <b>shadow mode</b> with a deny-all policy: it pays nothing ` +
          `until you set one with /policy ${code(agentId)}.\n` +
          `On the agent's machine run ${code(SETUP)} and paste the token below when asked.`,
        HTML,
      )
      await sendToken(ctx, created.token)
    })
  })

  /** Its own message, deleted after a minute. A failure is logged without the error: it holds the text. */
  async function sendToken(ctx: Context, token: string) {
    try {
      const sent = await ctx.reply(
        `${code(token)}\nCopy it now: this message deletes itself in about a minute.`,
        HTML,
      )
      tokens.push({ chatId: sent.chat.id, messageId: sent.message_id, at: now().getTime() })
    } catch {
      log.error('agent token message failed')
      await ctx.reply('The token could not be sent. Revoke this agent and create it again.')
    }
  }

  bot.command('doctor', (ctx) =>
    guarded(ctx, log, async () => {
      const blocks = doctorBlocks(await admin.doctor())
      for (const page of pages('<b>Doctor</b>', blocks)) {
        await ctx.reply(page, HTML)
      }
    }),
  )

  const policies = registerPolicies(bot, { admin, desk, log, now, button, cancel })

  /** Runs on the sweep timer. */
  async function sweep() {
    const due = tokens.filter(({ at }) => now().getTime() - at >= TOKEN_TTL_MS)
    for (const message of due) {
      tokens.splice(tokens.indexOf(message), 1)
      await bot.api
        .deleteMessage(message.chatId, message.messageId)
        .catch(() => log.warn('agent token message could not be deleted'))
    }
    await policies.offerGraduation()
  }

  return { sweep }
}
