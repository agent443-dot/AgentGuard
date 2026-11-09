import { describe, expect, it } from 'vitest'
// guard-core's own sender, so a change to how it signs or what it sends breaks this test first.
import { httpBotNotifier } from '../../guard-core/src/adapters/bot.js'
import type { Config } from '../../guard-core/src/config.js'
import { buildServer } from '../src/http/server.js'
import { approval, OWNER, SECRET, sent, setup, silent } from './support.js'

describe('the webhook guard-core sends', () => {
  it('passes signature and schema checks and reaches the owners', async () => {
    const { desk, calls } = setup()
    const app = await buildServer({
      secret: SECRET,
      handlers: {
        approvalRequest: (request) => desk.post(request),
        intentEvent: (event) => desk.event(event),
        alert: (event) => desk.alert(event),
      },
      logger: silent,
    })

    const viaInject: typeof fetch = async (input, init) => {
      const response = await app.inject({
        method: 'POST',
        url: new URL(String(input)).pathname,
        headers: Object.fromEntries(new Headers(init?.headers)),
        payload: String(init?.body),
      })
      return new Response(response.body, { status: response.statusCode })
    }
    const config = { BOT_URL: 'http://bot', BOT_WEBHOOK_SECRET: SECRET } as Config

    await httpBotNotifier(config, viaInject).requestApproval(approval())

    expect(sent(calls, 'sendMessage')[0]?.payload['chat_id']).toBe(OWNER.id)
    await expect(httpBotNotifier(config, viaInject).requestApproval(approval())).rejects.toThrow(
      'bot_webhook_failed: 409',
    )
  })
})
