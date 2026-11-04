import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'

const env = {
  TELEGRAM_BOT_TOKEN: '123456:ABC-def_ghi',
  OWNER_TELEGRAM_IDS: '1001, 1002',
  GUARD_URL: 'http://localhost:8787',
  GUARD_BOT_TOKEN: 'b'.repeat(32),
  GUARD_ADMIN_TOKEN: 'c'.repeat(32),
  BOT_WEBHOOK_SECRET: 'd'.repeat(32),
}

describe('loadConfig', () => {
  it('parses owners and the threshold', () => {
    const config = loadConfig(env)
    expect(config.OWNER_TELEGRAM_IDS).toEqual(new Set([1001, 1002]))
    expect(config.NOTIFY_ABOVE_AMOUNT).toBe(1_000_000n)
    expect(config.PORT).toBe(8788)
  })

  it('names the bad fields without echoing their values', () => {
    const attempt = () =>
      loadConfig({ ...env, OWNER_TELEGRAM_IDS: 'ana', BOT_WEBHOOK_SECRET: 'short' })
    expect(attempt).toThrow('invalid configuration: OWNER_TELEGRAM_IDS, BOT_WEBHOOK_SECRET')
    expect(attempt).not.toThrow(/short/)
  })

  it('needs at least one owner', () => {
    expect(() => loadConfig({ ...env, OWNER_TELEGRAM_IDS: '' })).toThrow('OWNER_TELEGRAM_IDS')
  })

  it('trims whitespace around each owner id', () => {
    const config = loadConfig({ ...env, OWNER_TELEGRAM_IDS: ' 1001 ,\t1002 ' })
    expect(config.OWNER_TELEGRAM_IDS).toEqual(new Set([1001, 1002]))
  })

  it.each([
    ['blank', '   '],
    ['trailing comma', '1001,'],
    ['leading comma', ',1001'],
    ['empty entry', '1001,,1002'],
    ['non-numeric', '1001,ana'],
    ['inner space', '10 01'],
    ['negative', '-1001'],
    ['zero', '0'],
    ['leading zero', '01001'],
    ['decimal', '1001.5'],
    ['exponent', '1e3'],
    ['past 2^53', '9007199254740993'],
  ])('refuses to start on a %s owner list, naming only the variable', (_case, ids) => {
    // The whole message, so the value cannot be in it.
    expect(() => loadConfig({ ...env, OWNER_TELEGRAM_IDS: ids })).toThrow(
      /^invalid configuration: OWNER_TELEGRAM_IDS$/,
    )
  })
})
