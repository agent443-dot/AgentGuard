import { describe, expect, it } from 'vitest'
import { TokenFileError, type TokenFileIo, withTokenFile } from '../src/token-file.js'

function io(mode: number, platform: NodeJS.Platform = 'linux'): TokenFileIo {
  return { read: () => ' tok-123\n', mode: () => mode, platform }
}

const missing: TokenFileIo = {
  read: () => {
    throw new Error('ENOENT')
  },
  mode: () => {
    throw new Error('ENOENT')
  },
  platform: 'linux',
}

describe('withTokenFile', () => {
  it('reads the token from the file, trimmed', () => {
    const env = withTokenFile({ AGENT_TOKEN_FILE: '/t' }, io(0o100600))
    expect(env['AGENT_TOKEN']).toBe('tok-123')
  })

  it('lets AGENT_TOKEN win and leaves env alone without a file', () => {
    const env = { AGENT_TOKEN: 'direct', AGENT_TOKEN_FILE: '/t' }
    expect(withTokenFile(env, missing)).toBe(env)
    const none = { AGENT_TOKEN_FILE: '' }
    expect(withTokenFile(none, missing)).toBe(none)
  })

  it('refuses a file others can read', () => {
    expect(() => withTokenFile({ AGENT_TOKEN_FILE: '/t' }, io(0o100644))).toThrow(
      /readable by others: run chmod 600/,
    )
  })

  it('ignores mode bits on Windows', () => {
    const env = withTokenFile({ AGENT_TOKEN_FILE: 'C:\\t' }, io(0o100666, 'win32'))
    expect(env['AGENT_TOKEN']).toBe('tok-123')
  })

  it('names the file, not the cause, when it cannot be read', () => {
    expect(() => withTokenFile({ AGENT_TOKEN_FILE: '/t' }, missing)).toThrow(TokenFileError)
    expect(() => withTokenFile({ AGENT_TOKEN_FILE: '/t' }, missing)).toThrow(
      'AGENT_TOKEN_FILE /t could not be read',
    )
  })
})
