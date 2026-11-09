import { createPrivateKey, type KeyObject } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'

const keypairFile = z.array(z.number().int().min(0).max(255)).length(64)
const evmKey = z.string().regex(/^0x[0-9a-fA-F]{64}$/)

/** A Solana CLI keypair file: a JSON array of the 64 secret key bytes. */
export async function readKeypairFile(path: string): Promise<Uint8Array> {
  const bytes = keypairFile.safeParse(parseJson(await readFile(path, 'utf8')))
  if (!bytes.success) {
    // The path, never the contents: this is the one file that must not reach a log.
    throw new Error(`invalid keypair file: ${path}`)
  }
  return Uint8Array.from(bytes.data)
}

/** Malformed JSON gives undefined: the parser's own error quotes the input, here a secret key. */
function parseJson(text: string): unknown {
  try {
    // The zod schema at the caller is exactly the validation the rule asks for.
    // eslint-disable-next-line no-restricted-properties
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** An EVM private key file: 0x and 64 hex digits, with any surrounding whitespace ignored. */
export async function readEvmKeyFile(path: string): Promise<`0x${string}`> {
  const key = evmKey.safeParse((await readFile(path, 'utf8')).trim())
  if (!key.success) {
    throw new Error(`invalid key file: ${path}`)
  }
  return key.data as `0x${string}`
}

/** The receipt signing key: an Ed25519 private key in PEM, kept apart from every hot wallet key. */
export async function readReceiptKeyFile(path: string): Promise<KeyObject> {
  try {
    const key = createPrivateKey(await readFile(path, 'utf8'))
    if (key.asymmetricKeyType === 'ed25519') {
      return key
    }
  } catch {
    // Reported below without the parser's message, which could quote the file.
  }
  throw new Error(`invalid receipt key file: ${path}`)
}
