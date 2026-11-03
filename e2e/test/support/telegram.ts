import { createBot, type GuardClient } from '@agentguard/telegram-bot'
import type { Update, UserFromGetMe } from 'grammy/types'
import type { Logger } from 'pino'

export const OWNER = { id: 1001, is_bot: false, first_name: 'Ana', username: 'ana' }
export const STRANGER = { id: 666, is_bot: false, first_name: 'Eve' }

const BOT_INFO: UserFromGetMe = {
  id: 42,
  is_bot: true,
  first_name: 'AgentGuard',
  username: 'agentguard_e2e_bot',
  can_join_groups: false,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
}

export interface Sent {
  method: string
  chatId: number
  messageId: number
  text: string
  buttons: string[]
}

type User = typeof OWNER | typeof STRANGER

/**
 * The real bot, with Telegram replaced: every API call is recorded, and updates are fed in as if
 * Telegram delivered them. What the owner would see is `messages`.
 */
export function telegram(guard: GuardClient, now: () => Date, log: Logger) {
  const { bot, desk } = createBot({
    token: '42:e2e',
    owners: new Set([OWNER.id]),
    guard,
    notifyAbove: 1_000_000n,
    log,
    now,
    botConfig: { botInfo: BOT_INFO },
  })
  const messages: Sent[] = []
  let nextId = 1
  let nextUpdate = 1

  bot.api.config.use(async (_prev, method, raw) => {
    const payload = raw as Record<string, unknown>
    const text = typeof payload['text'] === 'string' ? payload['text'] : ''
    const chatId = typeof payload['chat_id'] === 'number' ? payload['chat_id'] : 0
    const messageId = typeof payload['message_id'] === 'number' ? payload['message_id'] : nextId++
    messages.push({ method, chatId, messageId, text, buttons: buttons(payload) })
    // Each method only needs the fields the bot reads back from it.
    const result =
      method === 'sendMessage'
        ? { message_id: messageId, date: 0, chat: { id: chatId, type: 'private' }, text }
        : true
    return { ok: true, result } as never
  })

  async function feed(update: Omit<Update, 'update_id'>) {
    await bot.handleUpdate({ update_id: nextUpdate++, ...update } as Update)
  }

  function withButton(data: string): Sent | undefined {
    return messages.findLast((m) => m.buttons.includes(data))
  }

  /** Presses the button with this callback data on the latest message that shows it. */
  function tap(data: string, from: User = OWNER) {
    const message = withButton(data)
    return feed({
      callback_query: {
        id: String(nextUpdate),
        from,
        chat_instance: 'e2e',
        data,
        message: {
          message_id: message?.messageId ?? 0,
          date: 0,
          chat: { id: from.id, type: 'private', first_name: from.first_name },
          text: message?.text ?? '',
        },
      },
    })
  }

  return {
    desk,
    messages,
    /** The latest message sent to the owner that carries buttons for this intent. */
    approvalFor(intentId: string): Sent | undefined {
      return withButton(`approve:${intentId}`)
    },
    press(intentId: string, action: 'approve' | 'reject', from: User = OWNER) {
      return tap(`${action}:${intentId}`, from)
    },
    tap,
    /** The short answer Telegram shows the owner who pressed the last button. */
    lastAnswer(): string | undefined {
      return messages.findLast((m) => m.method === 'answerCallbackQuery')?.text
    },
    command(text: string, from: User = OWNER) {
      const name = text.split(' ')[0] ?? ''
      return feed({
        message: {
          message_id: nextId++,
          date: 0,
          chat: { id: from.id, type: 'private', first_name: from.first_name },
          from,
          text,
          entities: [{ type: 'bot_command', offset: 0, length: name.length }],
        },
      })
    },
  }
}

function buttons(payload: Record<string, unknown>): string[] {
  const markup = payload['reply_markup'] as { inline_keyboard?: { callback_data?: string }[][] }
  return (markup?.inline_keyboard ?? []).flat().flatMap((b) => b.callback_data ?? [])
}
