import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'

const base = {
  ADMIN_TOKEN: 'a'.repeat(64),
  BOT_TOKEN: 'b'.repeat(64),
  BOT_URL: 'http://bot.local',
  BOT_WEBHOOK_SECRET: 'c'.repeat(64),
}

const withOrigin =
  (origin: string, rpId = 'guard.example') =>
  () =>
    loadConfig({ ...base, PASSKEY_RP_ID: rpId, PASSKEY_ORIGIN: origin })

describe('the passkey origin', () => {
  it.each(['https://guard.example', 'https://pay.guard.example', 'https://guard.example:8443'])(
    'accepts %s for guard.example',
    (origin) => {
      expect(withOrigin(origin)).not.toThrow()
    },
  )

  it.each([
    'https://guard.example/',
    'https://guard.example/owner',
    'https://evilguard.example',
    'https://guard.example.evil',
    'https://example',
  ])('refuses %s for guard.example', (origin) => {
    expect(withOrigin(origin)).toThrow()
  })
})
