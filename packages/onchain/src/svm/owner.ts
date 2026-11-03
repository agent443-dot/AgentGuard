import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import type SolanaApp from '@ledgerhq/hw-app-solana'
import type HwTransport from '@ledgerhq/hw-transport'
import type NodeHid from '@ledgerhq/hw-transport-node-hid'
import { PublicKey, type Keypair, type VersionedTransaction } from '@solana/web3.js'
import { loadKeypair } from './config.js'

// The Ledger packages ship an ESM build Node cannot load (extensionless imports), so they are
// required as CommonJS, which is what their own `exports` map serves to `require`.
const require = createRequire(import.meta.url)
const { default: Solana } = require('@ledgerhq/hw-app-solana') as typeof SolanaApp

export type Transport = InstanceType<typeof HwTransport.default>

/**
 * The key that controls the multisig. On devnet it is a keypair file; on mainnet it lives on a
 * Ledger, and the key never leaves it, so everything the owner signs goes through this.
 */
export interface OwnerSigner {
  publicKey: PublicKey
  sign(transaction: VersionedTransaction): Promise<void>
}

export function fileOwner(path: string): OwnerSigner {
  return keypairOwner(loadKeypair(path))
}

export function keypairOwner(keypair: Keypair): OwnerSigner {
  return {
    publicKey: keypair.publicKey,
    sign: async (transaction) => transaction.sign([keypair]),
  }
}

/**
 * The same form the Solana CLI takes: `usb://ledger` is 44'/501', and `usb://ledger?key=0/1` is
 * 44'/501'/0'/1'. Using its convention means the owner sees the same address in both.
 */
export function ledgerPath(uri: string): string | undefined {
  const match = /^usb:\/\/ledger(?:\/[1-9A-HJ-NP-Za-km-z]+)?(?:\?key=(\d+(?:\/\d+)?))?$/.exec(uri)
  if (!match) {
    return undefined
  }
  const key = match[1]
  return key === undefined ? "44'/501'" : `44'/501'/${key.split('/').join("'/")}'`
}

/**
 * What the Solana app shows as "Message Hash" when it blind-signs: base58 of the SHA-256 of the
 * message bytes (LedgerHQ/app-solana, src/handle_sign_message.c). Base58 of 32 bytes is what a
 * PublicKey prints, so no encoder is needed.
 */
export function messageHash(message: Uint8Array): string {
  return new PublicKey(createHash('sha256').update(message).digest()).toBase58()
}

/**
 * Blind signing means the device cannot show what it signs, so a compromised computer could swap
 * the kill for a transaction that hands the vault over. The hash is the owner's only check: printed
 * here, shown on the device, and the owner rejects on any difference.
 */
export async function ledgerOwner(
  transport: Transport,
  path: string,
  tell: (line: string) => void,
): Promise<OwnerSigner> {
  const app = new Solana(transport)
  const { address } = await app.getAddress(path)
  const publicKey = new PublicKey(address)
  return {
    publicKey,
    async sign(transaction) {
      const message = Buffer.from(transaction.message.serialize())
      tell(`If the Ledger shows a Message Hash, it must read exactly: ${messageHash(message)}`)
      tell('Approve only on an exact match. On any difference, reject on the device.')
      let signature: Buffer
      try {
        ;({ signature } = await app.signTransaction(path, message))
      } catch (error) {
        // The Solana app shows Squads instructions only as a hash, which it refuses unless the owner
        // turned blind signing on. Saying so is the difference between a working kill switch and a
        // cryptic status code in an emergency.
        const reason = error instanceof Error ? error.message : String(error)
        throw new Error(`ledger_refused: ${reason}. Is blind signing enabled in the Solana app?`)
      }
      transaction.addSignature(publicKey, signature)
      tell('Signed. Turn Blind signing off again in the Solana app settings.')
    },
  }
}

/** A keypair path or a `usb://ledger` URI, as in SOLANA_OWNER_KEYPAIR. */
export async function loadOwner(
  source: string,
  tell: (line: string) => void,
): Promise<OwnerSigner> {
  const path = ledgerPath(source)
  if (path === undefined) {
    return fileOwner(source)
  }
  // Loaded only here: node-hid is a native module the devnet path and the tests never need.
  const { default: TransportNodeHid } = require('@ledgerhq/hw-transport-node-hid') as typeof NodeHid
  return ledgerOwner(await TransportNodeHid.create(), path, tell)
}
