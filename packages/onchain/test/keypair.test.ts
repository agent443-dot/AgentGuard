import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadKeypair } from '../src/svm/config.js'

describe('loadKeypair', () => {
  it('names only the path when the file is not JSON, never the bytes in it', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'onchain-key-')), 'owner.json')
    writeFileSync(path, '[201,202,203,204,x,205,206]')
    expect(() => loadKeypair(path)).toThrow(new Error(`invalid keypair file: ${path}`))
  })
})
