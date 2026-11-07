import { readFile } from 'node:fs/promises'
import { z } from 'zod'

const keypairFile = z.array(z.number().int().min(0).max(255)).length(64)
const evmKey = z.string().regex(/^0x[0-9a-fA-F]{64}$/)

/** A Solana CLI keypair file: a JSON array of the 64 secret key bytes. */
export async function readKeypairFile(path: string): Promise<Uint8Array> {
  // The zod schema right here is the validation the lint rule asks for.
  // eslint-disable-next-line no-restricted-properties
  const bytes = keypairFile.safeParse(JSON.parse(await readFile(path, 'utf8')))
  if (!bytes.success) {
    // The path, never the contents: this is the one file that must not reach a log.
    throw new Error(`invalid keypair file: ${path}`)
  }
  return Uint8Array.from(bytes.data)
}

/** An EVM private key file: 0x and 64 hex digits, with any surrounding whitespace ignored. */
export async function readEvmKeyFile(path: string): Promise<`0x${string}`> {
  const key = evmKey.safeParse((await readFile(path, 'utf8')).trim())
  if (!key.success) {
    throw new Error(`invalid key file: ${path}`)
  }
  return key.data as `0x${string}`
}
