import { mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TokenFileError, type TokenFileIo, withTokenFile } from '../src/token-file.js'

function io(mode: number, platform: NodeJS.Platform = 'linux', regular = true): TokenFileIo {
  return { open: () => ({ regular, mode, read: () => ' tok-123\n' }), platform }
}

const missing: TokenFileIo = {
  open: () => {
    throw new Error('ENOENT')
  },
  platform: 'linux',
}

describe('withTokenFile', () => {
  it('reads the token from the file, trimmed', () => {
    const env = withTokenFile({ AGENT_TOKEN_FILE: '/t' }, io(0o100600))
    expect(env['AGENT_TOKEN']).toBe('tok-123')
  })

  it('lets a non-empty AGENT_TOKEN win and leaves env alone without a file', () => {
    const env = { AGENT_TOKEN: 'direct', AGENT_TOKEN_FILE: '/t' }
    expect(withTokenFile(env, missing)).toBe(env)
    const none = { AGENT_TOKEN_FILE: '' }
    expect(withTokenFile(none, missing)).toBe(none)
  })

  it('treats an empty AGENT_TOKEN as unset', () => {
    const env = withTokenFile({ AGENT_TOKEN: '', AGENT_TOKEN_FILE: '/t' }, io(0o100600))
    expect(env['AGENT_TOKEN']).toBe('tok-123')
  })

  it('refuses a file others can read', () => {
    expect(() => withTokenFile({ AGENT_TOKEN_FILE: '/t' }, io(0o100644))).toThrow(
      /readable by others: run chmod 600/,
    )
  })

  it('refuses anything but a regular file', () => {
    expect(() => withTokenFile({ AGENT_TOKEN_FILE: '/t' }, io(0o020600, 'linux', false))).toThrow(
      'AGENT_TOKEN_FILE /t is not a regular file',
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

  it('reads a real 600 file and refuses a symlink to one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agentguard-'))
    const file = join(dir, 'token')
    writeFileSync(file, 'tok-real\n', { mode: 0o600 })
    expect(withTokenFile({ AGENT_TOKEN_FILE: file })['AGENT_TOKEN']).toBe('tok-real')
    symlinkSync(file, join(dir, 'link'))
    expect(() => withTokenFile({ AGENT_TOKEN_FILE: join(dir, 'link') })).toThrow(
      /could not be read/,
    )
  })
})
