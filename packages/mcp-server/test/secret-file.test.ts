import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fileExists, writeSecretFile } from '../src/adapters/terminal.js'

function home(): string {
  return mkdtempSync(join(tmpdir(), 'agentguard-home-'))
}

describe.skipIf(process.platform === 'win32')('writeSecretFile', () => {
  it('creates both directories 700 and the file 600', () => {
    const root = home()
    const path = join(root, '.agentguard', 'mcp', 'a.token')
    writeSecretFile(path, 'tok')
    expect(readFileSync(path, 'utf8')).toBe('tok\n')
    expect(lstatSync(path).mode & 0o777).toBe(0o600)
    expect(lstatSync(join(root, '.agentguard')).mode & 0o777).toBe(0o700)
    expect(lstatSync(join(root, '.agentguard', 'mcp')).mode & 0o777).toBe(0o700)
    expect(fileExists(path)).toBe(true)
  })

  it('replaces an existing 644 file with a fresh 600 one and leaves no temp file', () => {
    const root = home()
    const dir = join(root, '.agentguard', 'mcp')
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    chmodSync(join(root, '.agentguard'), 0o700)
    const path = join(dir, 'a.token')
    writeFileSync(path, 'old\n', { mode: 0o644 })
    writeSecretFile(path, 'new')
    expect(readFileSync(path, 'utf8')).toBe('new\n')
    expect(lstatSync(path).mode & 0o777).toBe(0o600)
    expect(readdirSync(dir)).toEqual(['a.token'])
  })

  it('replaces a planted symlink instead of writing through it', () => {
    const root = home()
    const dir = join(root, '.agentguard', 'mcp')
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    chmodSync(join(root, '.agentguard'), 0o700)
    const target = join(root, 'elsewhere')
    writeFileSync(target, 'untouched\n')
    symlinkSync(target, join(dir, 'a.token'))
    writeSecretFile(join(dir, 'a.token'), 'tok')
    expect(readFileSync(target, 'utf8')).toBe('untouched\n')
    expect(lstatSync(join(dir, 'a.token')).isSymbolicLink()).toBe(false)
  })

  it('refuses a directory others can enter', () => {
    const root = home()
    mkdirSync(join(root, '.agentguard'), { mode: 0o755 })
    chmodSync(join(root, '.agentguard'), 0o755)
    expect(() => writeSecretFile(join(root, '.agentguard', 'mcp', 'a.token'), 'tok')).toThrow(
      /\.agentguard is open to other users: run chmod 700 on it/,
    )
  })

  it('refuses a symlinked directory', () => {
    const root = home()
    const real = join(root, 'real')
    mkdirSync(real, { mode: 0o700 })
    symlinkSync(real, join(root, '.agentguard'))
    expect(() => writeSecretFile(join(root, '.agentguard', 'mcp', 'a.token'), 'tok')).toThrow(
      /is not a directory/,
    )
  })
})
