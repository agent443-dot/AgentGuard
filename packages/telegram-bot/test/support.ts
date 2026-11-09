import type { ApprovalRequest, PayIntent } from '@agentguard/shared'
import { CHAINS } from '@agentguard/shared'
import type { Bot } from 'grammy'
import type { Update, UserFromGetMe } from 'grammy/types'
import { pino } from 'pino'
import { vi } from 'vitest'
import type { GuardClient } from '../src/adapters/guard.js'
import { createBot } from '../src/bot/index.js'
import type { PhantomKill } from '../src/domain/phantom.js'
import type { ReportSchedule } from '../src/domain/report.js'

export const OWNER = { id: 1001, is_bot: false, first_name: 'Ana', username: 'ana' }
export const OTHER_OWNER = { id: 1002, is_bot: false, first_name: 'Bo' }
export const STRANGER = { id: 666, is_bot: false, first_name: 'Eve' }

export const SECRET = 'a'.repeat(64)
export const NOW = new Date('2026-11-03T12:00:00.000Z')
export const INTENT_ID = '4b8f6c0e-2a8e-4f7e-9a51-6f0c3d1a2b77'
export const RECIPIENT = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'

export const silent = pino({ level: 'silent' })

const BOT_INFO: UserFromGetMe = {
  id: 42,
  is_bot: true,
  first_name: 'AgentGuard',
  username: 'agentguard_test_bot',
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

export function intent(overrides: Partial<PayIntent> = {}): PayIntent {
  return {
    id: INTENT_ID,
    agentId: 'research-agent',
    kind: 'x402',
    chain: CHAINS.solanaDevnet,
    token: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    amount: '12500000',
    recipient: RECIPIENT,
    domain: 'api.example.com',
    reason: 'Buying the Q3 dataset',
    status: 'pending_approval',
    rejectReasons: [],
    createdAt: NOW.toISOString(),
    expiresAt: new Date(NOW.getTime() + 600_000).toISOString(),
    ...overrides,
  }
}

export function approval(overrides: Partial<PayIntent> = {}): ApprovalRequest {
  const payment = intent(overrides)
  return {
    intent: payment,
    simulation: { summary: 'Hot wallet -12.5 USDC', balanceChanges: [] },
    approveBefore: payment.expiresAt,
  }
}

export const MANDATE_ID = '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f'

export function mandateRequest(overrides: Record<string, unknown> = {}) {
  return {
    mandate: {
      id: MANDATE_ID,
      agentId: 'research-agent',
      budget: '25000000',
      spent: '0',
      domains: ['api.example.com', 'data.example.org'],
      recipients: [],
      reason: 'Compile the <b>Q3</b> report',
      status: 'pending_approval',
      createdAt: NOW.toISOString(),
      expiresAt: new Date(NOW.getTime() + 90 * 60_000).toISOString(),
      ...overrides,
    },
    simulation: { summary: 'Opens a task budget', balanceChanges: [] },
    approveBefore: new Date(NOW.getTime() + 600_000).toISOString(),
  }
}

export interface ApiCall {
  method: string
  payload: Record<string, unknown>
}

/** Every Telegram API call the bot makes lands here instead of on the network. */
export function mockTelegram(bot: Bot, fail: (call: ApiCall) => boolean = () => false) {
  const calls: ApiCall[] = []
  let nextId = 1
  bot.api.config.use(async (_prev, method, payload) => {
    const call = { method, payload: payload as Record<string, unknown> }
    calls.push(call)
    if (fail(call)) {
      return { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }
    }
    const result =
      method === 'sendMessage'
        ? {
            message_id: nextId++,
            date: 0,
            chat: { id: call.payload['chat_id'], type: 'private', first_name: 'owner' },
            text: call.payload['text'],
          }
        : true
    return { ok: true, result } as never
  })
  return calls
}

export function fakeGuard(overrides: Partial<GuardClient> = {}): GuardClient {
  return {
    decide: vi.fn(async (intentId: string, decision: string) => ({
      ok: true as const,
      intent: intent({
        id: intentId,
        status: decision === 'approve' ? 'approved' : 'rejected',
      }),
    })),
    decideMandate: vi.fn(async () => ({ ok: true as const })),
    setPaused: vi.fn(async () => 'ok' as const),
    kill: vi.fn(async () => ({ pausedAgents: 2, ownerTransactions: [] })),
    budget: vi.fn(async () => undefined),
    chains: vi.fn(async () => undefined),
    report: vi.fn(async () => []),
    healthy: vi.fn(async () => true),
    ...overrides,
  }
}

export function setup(
  options: {
    guard?: GuardClient
    now?: () => Date
    fail?: (call: ApiCall) => boolean
    phantomKills?: PhantomKill[]
    weekly?: ReportSchedule
  } = {},
) {
  const guard = options.guard ?? fakeGuard()
  const { bot, desk, commands } = createBot({
    token: '42:test-token',
    owners: new Set([OWNER.id, OTHER_OWNER.id]),
    guard,
    notifyAbove: 1_000_000n,
    log: silent,
    now: options.now ?? (() => NOW),
    botConfig: { botInfo: BOT_INFO },
    phantomKills: options.phantomKills,
    weekly: options.weekly,
  })
  const calls = mockTelegram(bot, options.fail)
  return { bot, desk, commands, guard, calls }
}

let updateId = 1

export function press(from: typeof OWNER | typeof STRANGER, data: string, messageId = 1): Update {
  return {
    update_id: updateId++,
    callback_query: {
      id: String(updateId),
      from,
      chat_instance: 'ci',
      data,
      message: {
        message_id: messageId,
        date: 0,
        chat: { id: from.id, type: 'private', first_name: from.first_name },
        text: 'Approval needed',
      },
    },
  }
}

export function command(from: typeof OWNER | typeof STRANGER, text: string): Update {
  const name = text.split(' ')[0] ?? text
  return {
    update_id: updateId++,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: from.id, type: 'private', first_name: from.first_name },
      from,
      text,
      entities: [{ type: 'bot_command', offset: 0, length: name.length }],
    },
  }
}

export function sent(calls: ApiCall[], method: string): ApiCall[] {
  return calls.filter((call) => call.method === method)
}
