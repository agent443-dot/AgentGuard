import { execFileSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { readEvmKeyFile, readKeypairFile, readReceiptKeyFile } from '../src/adapters/keypair.js'

const ENTRYPOINT = join(import.meta.dirname, '../deploy/entrypoint.sh')
const SOLANA_KEY = JSON.stringify(Array.from({ length: 64 }, (_, i) => i))
const BASE_KEY = `0x${'ab'.repeat(32)}`
const ROBINHOOD_KEY = `0x${'cd'.repeat(32)}`
const RECEIPT_KEY = generateKeyPairSync('ed25519')
  .privateKey.export({ format: 'pem', type: 'pkcs8' })
  .toString()

// Mounting tmpfs and dropping to another user both need root, as on a Fly machine.
const root = process.platform === 'linux' && process.getuid?.() === 0
// The parent must be traversable by the app user, as /run is.
const parent = mkdtempSync(join(tmpdir(), 'guard-entry-'))
chmodSync(parent, 0o755)
const dir = join(parent, 'run')
const data = join(parent, 'data')
mkdirSync(data)

describe.skipIf(!root)('deploy/entrypoint.sh', () => {
  afterAll(() => {
    execFileSync('umount', [dir])
  })

  const run = (script: string) =>
    execFileSync(ENTRYPOINT, ['sh', '-c', script], {
      encoding: 'utf8',
      env: {
        PATH: process.env['PATH'],
        AGENTGUARD_KEY_DIR: dir,
        AGENTGUARD_USER: 'nobody',
        AGENTGUARD_DATA_DIR: data,
        SOLANA_HOT_WALLET_KEYPAIR_JSON: SOLANA_KEY,
        BASE_HOT_WALLET_KEY: BASE_KEY,
        ROBINHOOD_HOT_WALLET_KEY: ROBINHOOD_KEY,
        RECEIPT_SIGNING_KEY: RECEIPT_KEY,
      },
    })

  it('moves every key to tmpfs files and out of the environment of what it runs', () => {
    const env = run('env')
    expect(env).not.toContain(SOLANA_KEY)
    expect(env).not.toContain(BASE_KEY)
    expect(env).not.toContain(ROBINHOOD_KEY)
    expect(env).not.toContain('PRIVATE KEY')
    expect(env).toContain(`SOLANA_HOT_WALLET_KEYPAIR=${dir}/hot.json`)
    expect(env).toContain(`BASE_HOT_WALLET_KEY_FILE=${dir}/base-hot`)
    expect(env).toContain(`ROBINHOOD_HOT_WALLET_KEY_FILE=${dir}/robinhood-hot`)
    expect(env).toContain(`RECEIPT_SIGNING_KEY_FILE=${dir}/receipt.pem`)
    expect(execFileSync('stat', ['-f', '-c', '%T', dir], { encoding: 'utf8' }).trim()).toBe('tmpfs')
  })

  it('runs the command as the app user, the only one who can read the files', () => {
    const nobody = execFileSync('id', ['-u', 'nobody'], { encoding: 'utf8' }).trim()
    expect(run('id -u').trim()).toBe(nobody)
    expect(String(statSync(data).uid)).toBe(nobody)
    for (const file of ['hot.json', 'base-hot', 'robinhood-hot', 'receipt.pem']) {
      const stat = statSync(join(dir, file))
      expect(stat.mode & 0o777).toBe(0o600)
      expect(String(stat.uid)).toBe(nobody)
    }
  })

  it('writes files guard-core reads back as the same keys', async () => {
    run('true')
    expect(await readKeypairFile(join(dir, 'hot.json'))).toEqual(
      Uint8Array.from(JSON.parse(SOLANA_KEY) as number[]),
    )
    expect(await readEvmKeyFile(join(dir, 'base-hot'))).toBe(BASE_KEY)
    expect(await readEvmKeyFile(join(dir, 'robinhood-hot'))).toBe(ROBINHOOD_KEY)
    expect((await readReceiptKeyFile(join(dir, 'receipt.pem'))).asymmetricKeyType).toBe('ed25519')
  })
})
