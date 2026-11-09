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

const killPage = {
  SIGN_PAGE_URL: 'https://sign.agentguard.example',
  SQUADS_MULTISIG: '3UUSmTssQT7xAnH7SKiStPyy1Tn2SUqUM53Ns7XnUcVu',
  SOLANA_HOT_WALLET_PUBKEY: 'AxCgDMb1uirKHyEsC3WUkWY8G7CYa1BE1YX4j5bFpita',
}

describe('loadConfig', () => {
  it('parses owners and the threshold', () => {
    const config = loadConfig(env)
    expect(config.OWNER_TELEGRAM_IDS).toEqual(new Set([1001, 1002]))
    expect(config.NOTIFY_ABOVE_AMOUNT).toBe(1_000_000n)
    expect(config.PORT).toBe(8788)
    expect(config.HOOK_RATE_LIMIT_PER_MINUTE).toBe(300)
  })

  it('names the bad fields without echoing their values', () => {
    const attempt = () =>
      loadConfig({ ...env, OWNER_TELEGRAM_IDS: 'ana', BOT_WEBHOOK_SECRET: 'short' })
    expect(attempt).toThrow('invalid configuration: OWNER_TELEGRAM_IDS, BOT_WEBHOOK_SECRET')
    expect(attempt).not.toThrow(/short/)
  })

  it('has no kill page unless SIGN_PAGE_URL is set, and treats an empty line as unset', () => {
    expect(loadConfig(env).SIGN_PAGE_URL).toBeUndefined()
    expect(loadConfig({ ...env, SIGN_PAGE_URL: '' }).SIGN_PAGE_URL).toBeUndefined()
    expect(loadConfig(env).SOLANA_CHAIN).toBe('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1')
  })

  it('takes an https kill page with both Solana keys', () => {
    const config = loadConfig({ ...env, ...killPage })
    expect(config.SIGN_PAGE_URL).toBe(killPage.SIGN_PAGE_URL)
    expect(config.SQUADS_MULTISIG).toBe(killPage.SQUADS_MULTISIG)
  })

  it.each([
    ['http', { SIGN_PAGE_URL: 'http://sign.agentguard.example' }],
    ['a query', { SIGN_PAGE_URL: 'https://sign.agentguard.example/?action=create' }],
    ['a fragment', { SIGN_PAGE_URL: 'https://sign.agentguard.example/#x' }],
    ['not a url', { SIGN_PAGE_URL: 'sign.agentguard.example' }],
  ])('refuses a kill page with %s', (_case, override) => {
    expect(() => loadConfig({ ...env, ...killPage, ...override })).toThrow(
      /^invalid configuration: SIGN_PAGE_URL$/,
    )
  })

  it('refuses a kill page without the keys the link needs', () => {
    expect(() => loadConfig({ ...env, SIGN_PAGE_URL: killPage.SIGN_PAGE_URL })).toThrow(
      /^invalid configuration: SQUADS_MULTISIG, SOLANA_HOT_WALLET_PUBKEY, ROBINHOOD_SAFE_ADDRESS$/,
    )
    expect(() => loadConfig({ ...env, ...killPage, SQUADS_MULTISIG: '0xabc' })).toThrow(
      /^invalid configuration: SQUADS_MULTISIG$/,
    )
    expect(() => loadConfig({ ...env, ...killPage, SOLANA_CHAIN: 'eip155:84532' })).toThrow(
      /^invalid configuration: SOLANA_CHAIN$/,
    )
  })

  it('takes a Robinhood Safe alone, or with Solana, but never half a Solana chain', () => {
    const safe = { ROBINHOOD_SAFE_ADDRESS: '0x8b3a0e2c5d7f9a1b4c6e8d0f2a4b6c8d0e2f4a6b' }
    const robinhood = loadConfig({ ...env, SIGN_PAGE_URL: killPage.SIGN_PAGE_URL, ...safe })
    expect(robinhood.ROBINHOOD_SAFE_ADDRESS).toBe(safe.ROBINHOOD_SAFE_ADDRESS)
    expect(robinhood.ROBINHOOD_CHAIN).toBe('eip155:46630')
    expect(loadConfig({ ...env, ...killPage, ...safe }).SQUADS_MULTISIG).toBe(
      killPage.SQUADS_MULTISIG,
    )
    expect(() =>
      loadConfig({
        ...env,
        ...safe,
        SIGN_PAGE_URL: killPage.SIGN_PAGE_URL,
        SQUADS_MULTISIG: killPage.SQUADS_MULTISIG,
      }),
    ).toThrow(/^invalid configuration: SOLANA_HOT_WALLET_PUBKEY$/)
    expect(() => loadConfig({ ...env, ...killPage, ROBINHOOD_SAFE_ADDRESS: 'AxCg' })).toThrow(
      /^invalid configuration: ROBINHOOD_SAFE_ADDRESS$/,
    )
    expect(() => loadConfig({ ...env, ...killPage, ROBINHOOD_CHAIN: 'eip155:84532' })).toThrow(
      /^invalid configuration: ROBINHOOD_CHAIN$/,
    )
  })

  it('takes the weekly report schedule as both values or neither', () => {
    const config = loadConfig({ ...env, REPORT_WEEKDAY: '1', REPORT_HOUR_UTC: '9' })
    expect([config.REPORT_WEEKDAY, config.REPORT_HOUR_UTC]).toEqual([1, 9])
    expect(loadConfig({ ...env, REPORT_WEEKDAY: '', REPORT_HOUR_UTC: '' }).REPORT_WEEKDAY).toBe(
      undefined,
    )
    expect(() => loadConfig({ ...env, REPORT_WEEKDAY: '1' })).toThrow(
      /^invalid configuration: REPORT_HOUR_UTC$/,
    )
    expect(() => loadConfig({ ...env, REPORT_WEEKDAY: '7', REPORT_HOUR_UTC: '9' })).toThrow(
      /^invalid configuration: REPORT_WEEKDAY$/,
    )
    expect(() => loadConfig({ ...env, REPORT_WEEKDAY: '1', REPORT_HOUR_UTC: '24' })).toThrow(
      /^invalid configuration: REPORT_HOUR_UTC$/,
    )
  })

  it("takes guard-core's public page only over https", () => {
    const page = 'https://guard.agentguard.example'
    expect(loadConfig({ ...env, GUARD_PUBLIC_URL: page }).GUARD_PUBLIC_URL).toBe(page)
    expect(loadConfig({ ...env, GUARD_PUBLIC_URL: '' }).GUARD_PUBLIC_URL).toBeUndefined()
    for (const bad of ['http://guard.agentguard.example', `${page}/?x=1`, 'guard']) {
      expect(() => loadConfig({ ...env, GUARD_PUBLIC_URL: bad })).toThrow(
        /^invalid configuration: GUARD_PUBLIC_URL$/,
      )
    }
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
