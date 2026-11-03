import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  ComputeBudgetProgram,
  Keypair,
  SystemProgram,
  VersionedMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import type HwTransport from '@ledgerhq/hw-transport'
import type { Transport } from '../src/svm/owner.js'

const require = createRequire(import.meta.url)
const { default: TransportBase } = require('@ledgerhq/hw-transport') as typeof HwTransport

const OK = Buffer.from([0x90, 0x00])
const BLIND_SIGNATURE_REQUIRED = Buffer.from([0x68, 0x08])
const INS_GET_ADDR = 0x05
const INS_SIGN = 0x06
const P2_MORE = 0x02

// The programs the Solana app can show in clear. Anything else, Squads included, is a blind signature.
const CLEAR = [SystemProgram.programId, TOKEN_PROGRAM_ID, ComputeBudgetProgram.programId]

/**
 * A Ledger running the Solana app, speaking the app's APDUs over the real hw-transport so that the
 * official hw-app-solana client is what talks to it. Each derivation path gets its own key, and
 * signatures are real ed25519, so a transaction it signs verifies on chain.
 */
export class FakeLedger extends TransportBase {
  blindSigning = true
  readonly signed: VersionedMessage[] = []
  private pending = Buffer.alloc(0)

  keyFor(path: Buffer): Keypair {
    return Keypair.fromSeed(createHash('sha256').update('fake-ledger').update(path).digest())
  }

  override async exchange(apdu: Buffer): Promise<Buffer> {
    const [, ins, , p2] = apdu
    const data = apdu.subarray(5, 5 + (apdu[4] ?? 0))
    if (ins === INS_GET_ADDR) {
      return Buffer.concat([this.keyFor(data).publicKey.toBuffer(), OK])
    }
    if (ins !== INS_SIGN) {
      return Buffer.from([0x6d, 0x00])
    }
    this.pending = Buffer.concat([this.pending, data])
    if ((p2 ?? 0) & P2_MORE) {
      return OK
    }
    const payload = this.pending
    this.pending = Buffer.alloc(0)
    // One path: [count = 1][path length][4 bytes per level], then the message.
    const pathEnd = 2 + (payload[1] ?? 0) * 4
    const message = VersionedMessage.deserialize(payload.subarray(pathEnd))
    const programs = message.compiledInstructions.map(
      (ix) => message.staticAccountKeys[ix.programIdIndex],
    )
    if (!this.blindSigning && programs.some((id) => !CLEAR.some((clear) => id?.equals(clear)))) {
      return BLIND_SIGNATURE_REQUIRED
    }
    const tx = new VersionedTransaction(message)
    const key = this.keyFor(payload.subarray(1, pathEnd))
    tx.sign([key])
    this.signed.push(message)
    const index = message.staticAccountKeys.findIndex((k) => k.equals(key.publicKey))
    return Buffer.concat([Buffer.from(tx.signatures[index] ?? []), OK])
  }
}

export const fakeLedger = (): FakeLedger & Transport => new FakeLedger() as FakeLedger & Transport
