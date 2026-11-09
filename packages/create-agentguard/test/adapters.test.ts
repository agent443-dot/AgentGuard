import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { diskFiles } from '../src/adapters/files.js'
import { localKeys } from '../src/adapters/keys.js'

describe('localKeys', () => {
  it('makes a 64-byte Solana keypair file whose address it can read back', () => {
    const key = localKeys.generate('solana')
    expect(key.contents).toMatch(/^\[(\d{1,3},){63}\d{1,3}\]\n$/)
    expect(localKeys.address('solana', key.contents)).toBe(key.address)
  })

  it('makes an EVM key file of 0x and 64 hex digits', () => {
    const key = localKeys.generate('robinhood')
    expect(key.contents).toMatch(/^0x[0-9a-f]{64}\n$/)
    expect(localKeys.address('robinhood', key.contents)).toBe(key.address)
  })

  it('refuses a file that is not a key without quoting it', () => {
    for (const [family, contents] of [
      ['solana', 'not json secret'],
      ['solana', '[1,2]'],
      ['robinhood', '0xsecret'],
    ] as const) {
      expect(() => localKeys.address(family, contents)).toThrow(/^an existing hot key file/)
    }
  })
})

describe('diskFiles', () => {
  let dir = ''
  afterEach(() => rm(dir, { recursive: true, force: true }))

  it('keeps the directory 0700 and every file 0600, and never overwrites a key', async () => {
    dir = await mkdtemp(join(tmpdir(), 'create-agentguard-'))
    const home = join(dir, '.agentguard')
    await diskFiles.ensureDir(home)
    expect((await stat(home)).mode & 0o777).toBe(0o700)
    const key = join(home, 'hot.json')
    await diskFiles.write(key, '[1]\n', { create: true })
    expect((await stat(key)).mode & 0o777).toBe(0o600)
    await expect(diskFiles.write(key, '[2]\n', { create: true })).rejects.toThrow(
      /never overwrites/,
    )
    expect(await diskFiles.read(key)).toBe('[1]\n')
    await diskFiles.write(join(home, 'state.json'), '{}')
    expect(await diskFiles.list(home)).toEqual(['hot.json', 'state.json'])
    expect(await diskFiles.list(join(dir, 'missing'))).toEqual([])
    expect(await diskFiles.exists(join(dir, 'missing'))).toBe(false)
  })
})
