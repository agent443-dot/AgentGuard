import type { Policy } from '@agentguard/shared'
import { type Bot, type Context, InlineKeyboard } from 'grammy'
import type { Logger } from 'pino'
import type { AdminClient } from '../adapters/admin.js'
import type { GuardClient, ShadowTotal } from '../adapters/guard.js'
import { formatUsd } from '../domain/money.js'
import {
  hostname,
  LIMIT_NAMES,
  LIMITS,
  type Limit,
  parseDollars,
  policyText,
  PRESETS,
  raises,
  raiseText,
} from '../domain/policy.js'
import { utcTime } from '../domain/text.js'
import type { Desk } from './desk.js'
import { args, code, guarded, HTML, type Press, validAgent } from './owner-kit.js'

export interface PolicyDeps {
  admin: AdminClient
  guard: GuardClient
  desk: Desk
  log: Logger
  now: () => Date
  button: (run: Press, ttlMs?: number) => string
  cancel: InlineKeyboard
}

type Change = Partial<Pick<Policy, Limit | 'mode' | 'allowedDomains'>>

const MAX_DOMAINS = 256
const OFFER_TTL_MS = 7 * 86_400_000
/** How long an agent runs in shadow mode before the bot offers to take it live. */
export const GRADUATION_MS = 3 * 86_400_000
const GRADUATION_CHECK_MS = 5 * 60_000

export function registerPolicies(bot: Bot, { admin, guard, desk, log, now, button }: PolicyDeps) {
  /** The prompts waiting for the owner's reply, keyed by chat and prompt message. */
  const edits = new Map<string, { agentId: string; limit: Limit }>()

  function policyKeyboard(agentId: string) {
    const keyboard = new InlineKeyboard()
    for (const preset of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
      keyboard.text(
        preset,
        button((press) => change(press, agentId, PRESETS[preset])),
      )
    }
    keyboard.row()
    for (const limit of LIMITS) {
      keyboard.text(
        `Edit ${LIMIT_NAMES[limit]}`,
        button(async (press) => {
          const prompt = await press.reply(
            `New ${LIMIT_NAMES[limit]} for ${code(agentId)}, in dollars (like 2.50):`,
            { ...HTML, reply_markup: { force_reply: true } },
          )
          edits.set(`${prompt.chat.id}:${prompt.message_id}`, { agentId, limit })
        }),
      )
    }
    return keyboard
  }

  /**
   * Reads the policy, applies the change and writes it back. A raise of any limit is shown first
   * and applied only from its confirm button, which reads the policy again when pressed.
   */
  async function change(ctx: Context, agentId: string, next: Change, confirmed = false) {
    const before = await admin.policy(agentId)
    if (before === undefined) {
      await ctx.reply(`No agent ${code(agentId)}.`, HTML)
      return
    }
    const after = { ...before, ...next }
    const up = raises(before, after)
    if (up.length > 0 && !confirmed) {
      const keyboard = new InlineKeyboard()
        .text(
          'Raise',
          button((press) => change(press, agentId, next, true)),
        )
        .text('Cancel', 'own:cancel')
      await ctx.reply(raiseText(agentId, before, after, up), { ...HTML, reply_markup: keyboard })
      return
    }
    const saved = await admin.putPolicy(after)
    log.info({ agentId, owner: ctx.from?.id, change: Object.keys(next) }, 'policy changed')
    await ctx.reply(`Saved.\n${policyText(saved)}`, HTML)
  }

  bot.command('policy', (ctx) => {
    const [agentId] = args(ctx)
    if (!validAgent(agentId)) {
      return ctx.reply('Usage: /policy &lt;agentId&gt;', HTML)
    }
    return guarded(ctx, log, async () => {
      const policy = await admin.policy(agentId)
      await ctx.reply(policy === undefined ? `No agent ${code(agentId)}.` : policyText(policy), {
        ...HTML,
        ...(policy === undefined ? {} : { reply_markup: policyKeyboard(agentId) }),
      })
    })
  })

  bot.on('message:text', async (ctx, next) => {
    const reply = ctx.message.reply_to_message
    const key = reply === undefined ? '' : `${reply.chat.id}:${reply.message_id}`
    const edit = edits.get(key)
    if (edit === undefined) {
      return next()
    }
    const amount = parseDollars(ctx.message.text)
    if (amount === undefined) {
      await ctx.reply('Send an amount in dollars, like 2.50. Reply to the question again.')
      return
    }
    edits.delete(key)
    await guarded(ctx, log, () => change(ctx, edit.agentId, { [edit.limit]: amount }))
  })

  for (const [command, add] of [
    ['allow', true],
    ['deny', false],
  ] as const) {
    bot.command(command, (ctx) => {
      const [agentId, domain] = args(ctx)
      const host = hostname(domain ?? '')
      if (!validAgent(agentId) || host === undefined) {
        return ctx.reply(
          `Usage: /${command} &lt;agentId&gt; &lt;domain&gt;, like api.example.com`,
          HTML,
        )
      }
      return guarded(ctx, log, async () => {
        const policy = await admin.policy(agentId)
        if (policy === undefined) {
          await ctx.reply(`No agent ${code(agentId)}.`, HTML)
          return
        }
        const others = policy.allowedDomains.filter((d) => d !== host)
        if (add && others.length >= MAX_DOMAINS) {
          await ctx.reply(
            `${code(agentId)} already allows ${MAX_DOMAINS} domains, the most it can.`,
            HTML,
          )
          return
        }
        await change(ctx, agentId, { allowedDomains: add ? [...others, host] : others })
      })
    })
  }

  const payments = (count: number) => `${count} ${count === 1 ? 'payment' : 'payments'}`

  function liveText(agentId: string, shadow: ShadowTotal | undefined): string {
    const would =
      shadow === undefined || shadow.count === 0
        ? 'guard-core reports no shadowed payment for it.'
        : `In shadow mode it would have spent ${formatUsd(shadow.total)} in ` +
          `${payments(shadow.count)} since ${utcTime(shadow.since)}.`
    return `<b>Go live</b> with ${code(agentId)}? It starts signing real payments.\n${would}`
  }

  async function offerLive(ctx: Context, agentId: string) {
    const keyboard = new InlineKeyboard()
      .text(
        'Go live',
        button((press) => change(press, agentId, { mode: 'live' })),
      )
      .text('Cancel', 'own:cancel')
    const shadow = (await guard.budget(agentId))?.shadow
    await ctx.reply(liveText(agentId, shadow), { ...HTML, reply_markup: keyboard })
  }

  bot.command('mode', (ctx) => {
    const [agentId, mode] = args(ctx)
    if (!validAgent(agentId) || (mode !== 'live' && mode !== 'shadow')) {
      return ctx.reply('Usage: /mode &lt;agentId&gt; live|shadow', HTML)
    }
    return guarded(ctx, log, () =>
      mode === 'live' ? offerLive(ctx, agentId) : change(ctx, agentId, { mode: 'shadow' }),
    )
  })

  // Only "already offered" is kept here: guard-core keeps the totals, so a bot restart repeats an
  // offer at most once.
  const offered = new Set<string>()
  let checked = 0

  /** Runs on the sweep timer, but asks guard-core at most every few minutes. */
  async function offerGraduation() {
    if (now().getTime() - checked < GRADUATION_CHECK_MS) {
      return
    }
    checked = now().getTime()
    for (const { agentId, mode } of await admin.listAgents()) {
      if (mode !== 'shadow' || offered.has(agentId)) {
        continue
      }
      const shadow = (await guard.budget(agentId))?.shadow
      if (shadow === undefined || now().getTime() - Date.parse(shadow.since) < GRADUATION_MS) {
        continue
      }
      offered.add(agentId)
      const text =
        `Your agent ${code(agentId)} would have spent ${formatUsd(shadow.total)} ` +
        `in ${payments(shadow.count)}. Go live?`
      const keyboard = new InlineKeyboard().text(
        'Go live…',
        // An offer the owner may only read the next day: it stays usable longer than a confirm.
        button((press) => offerLive(press, agentId), OFFER_TTL_MS),
      )
      await desk.announce(text, keyboard)
    }
  }

  return { offerGraduation }
}
