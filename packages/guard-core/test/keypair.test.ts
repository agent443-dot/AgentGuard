import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readKeypairFile } from '../src/adapters/keypair.js'

describe('readKeypairFile', () => {
  it('names only the path when the file is not JSON, never the bytes in it', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'guard-key-')), 'hot.json')
    writeFileSync(path, '[201,202,203,204,x,205,206]')
    const error = await readKeypairFile(path).catch((thrown: unknown) => thrown)
    expect(error).toEqual(new Error(`invalid keypair file: ${path}`))
    expect(String(error)).not.toContain('203')
  })
})
