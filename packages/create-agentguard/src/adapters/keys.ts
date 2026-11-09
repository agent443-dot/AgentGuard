import { Keypair } from '@solana/web3.js'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { z } from 'zod'
import { WizardError } from '../domain/errors.js'
import type { Family } from '../domain/networks.js'

export interface HotKey {
  /** The key file's contents. Written to disk and nowhere else. */
  contents: string
  address: string
}

export interface KeyMaker {
  generate(family: Family): HotKey
  /** The public address of an existing key file. */
  address(family: Family, contents: string): string
}

const secretKey = z.array(z.number().int().min(0).max(255)).length(64)
const evmKey = z.string().regex(/^0x[0-9a-fA-F]{64}$/)

// Neither message quotes the file: its contents are the key.
const unreadable = () =>
  new WizardError('INVALID_INPUT', 'an existing hot key file is not a key this wizard can read')

function solanaAddress(contents: string): string {
  let parsed: unknown
  try {
    // Checked by secretKey on the next line.
    // eslint-disable-next-line no-restricted-properties
    parsed = JSON.parse(contents)
  } catch {
    throw unreadable()
  }
  const bytes = secretKey.safeParse(parsed)
  if (!bytes.success) {
    throw unreadable()
  }
  return Keypair.fromSecretKey(Uint8Array.from(bytes.data)).publicKey.toBase58()
}

function evmAddress(contents: string): string {
  const key = evmKey.safeParse(contents.trim())
  if (!key.success) {
    throw unreadable()
  }
  return privateKeyToAccount(key.data as `0x${string}`).address
}

/** Keys are made in this process, so no key material is ever an argument or a child's input. */
export const localKeys: KeyMaker = {
  generate(family) {
    if (family === 'solana') {
      const keypair = Keypair.generate()
      return {
        // The 64-byte array solana-keygen writes and guard-core reads.
        contents: `${JSON.stringify(Array.from(keypair.secretKey))}\n`,
        address: keypair.publicKey.toBase58(),
      }
    }
    const key = generatePrivateKey()
    return { contents: `${key}\n`, address: privateKeyToAccount(key).address }
  },
  address: (family, contents) =>
    family === 'solana' ? solanaAddress(contents) : evmAddress(contents),
}
