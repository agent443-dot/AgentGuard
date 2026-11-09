import { describe, expect, it } from 'vitest'
import { rewriteFlyToml } from '../src/domain/flytoml.js'
import { repoFile } from './fakes.js'

const guard = repoFile('packages/guard-core/fly.toml')
const bot = repoFile('packages/telegram-bot/fly.toml')

function changed(before: string, after: string): [string, string][] {
  const a = before.split('\n')
  const b = after.split('\n')
  expect(b).toHaveLength(a.length)
  return a.flatMap((line, i) => (line === b[i] ? [] : [[line, b[i] ?? '']]))
}

describe('rewriteFlyToml', () => {
  it("changes only guard-core's app, region and BOT_URL host", () => {
    const out = rewriteFlyToml(guard, {
      app: 'acme-guard-core',
      region: 'iad',
      peer: { name: 'BOT_URL', app: 'acme-bot' },
    })
    expect(changed(guard, out)).toEqual([
      ['app = "agentguard-guard-core"', 'app = "acme-guard-core"'],
      ['primary_region = "gru"', 'primary_region = "iad"'],
      [
        '  BOT_URL = "http://agentguard-bot.internal:8788"',
        '  BOT_URL = "http://acme-bot.internal:8788"',
      ],
    ])
  })

  it("changes only the bot's app, region and GUARD_URL host, keeping the port", () => {
    const out = rewriteFlyToml(bot, {
      app: 'acme-bot',
      region: 'gru',
      peer: { name: 'GUARD_URL', app: 'acme-guard-core' },
    })
    expect(changed(bot, out)).toEqual([
      ['app = "agentguard-bot"', 'app = "acme-bot"'],
      [
        '  GUARD_URL = "http://agentguard-guard-core.internal:8787"',
        '  GUARD_URL = "http://acme-guard-core.internal:8787"',
      ],
    ])
  })

  it('refuses a fly.toml whose shape it does not know', () => {
    const changes = { app: 'a-b', region: 'gru', peer: { name: 'BOT_URL', app: 'x-bot' } } as const
    expect(() => rewriteFlyToml(guard.replace(/^app = .*$/m, ''), changes)).toThrow(/app line/)
    expect(() => rewriteFlyToml(`${guard}\napp = "again"\n`, changes)).toThrow(/exactly one app/)
    expect(() => rewriteFlyToml(guard.replace(/BOT_URL/, 'OTHER'), changes)).toThrow(/BOT_URL/)
    expect(() => rewriteFlyToml(guard.replace(/primary_region.*/, ''), changes)).toThrow(
      /primary_region/,
    )
  })
})
