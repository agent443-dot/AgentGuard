import { createRequire } from 'node:module'
import type HwTransport from '@ledgerhq/hw-transport'
import { concat, keccak256, parseSignature, toHex, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Transport } from '../src/svm/owner.js'

const require = createRequire(import.meta.url)
const { default: TransportBase } = require('@ledgerhq/hw-transport') as typeof HwTransport

const OK = Buffer.from([0x90, 0x00])
const INS_GET_ADDRESS = 0x02
const INS_SIGN_EIP712_HASHED = 0x0c

/**
 * A Ledger running the Ethereum app, speaking its APDUs over the real hw-transport so the official
 * hw-app-eth client is what talks to it. Each derivation path gets its own secp256k1 key, and it
 * signs EIP-712 the way the app does, over keccak256(0x1901 || domain hash || message hash).
 */
export class FakeEthLedger extends TransportBase {
  /** The two hashes the app would put on screen, per signature. */
  readonly shown: { domainHash: Hex; messageHash: Hex }[] = []

  keyFor(path: Buffer) {
    return privateKeyToAccount(keccak256(concat(['0x6c6564676572', toHex(path)])))
  }

  override async exchange(apdu: Buffer): Promise<Buffer> {
    const ins = apdu[1]
    const data = apdu.subarray(5, 5 + (apdu[4] ?? 0))
    const pathEnd = 1 + (data[0] ?? 0) * 4
    const key = this.keyFor(data.subarray(0, pathEnd))
    if (ins === INS_GET_ADDRESS) {
      const publicKey = Buffer.from(key.publicKey.slice(2), 'hex')
      const address = Buffer.from(key.address.slice(2).toLowerCase(), 'ascii')
      return Buffer.concat([
        Buffer.from([publicKey.length]),
        publicKey,
        Buffer.from([address.length]),
        address,
        OK,
      ])
    }
    if (ins !== INS_SIGN_EIP712_HASHED) {
      return Buffer.from([0x6d, 0x00])
    }
    const domainHash = toHex(data.subarray(pathEnd, pathEnd + 32))
    const messageHash = toHex(data.subarray(pathEnd + 32, pathEnd + 64))
    this.shown.push({ domainHash, messageHash })
    const { r, s, v } = parseSignature(
      await key.sign({ hash: keccak256(concat(['0x1901', domainHash, messageHash])) }),
    )
    return Buffer.concat([
      Buffer.from([Number(v)]),
      Buffer.from(r.slice(2), 'hex'),
      Buffer.from(s.slice(2), 'hex'),
      OK,
    ])
  }
}

export const fakeEthLedger = (): FakeEthLedger & Transport =>
  new FakeEthLedger() as FakeEthLedger & Transport
