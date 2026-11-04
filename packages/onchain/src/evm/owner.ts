import { createRequire } from 'node:module'
import type EthApp from '@ledgerhq/hw-app-eth'
import type NodeHid from '@ledgerhq/hw-transport-node-hid'
import {
  getAddress,
  hashDomain,
  hashStruct,
  hashTypedData,
  serializeSignature,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Transport } from '../svm/owner.js'

// The same CommonJS loading as the Solana Ledger code, for the same broken ESM build.
const require = createRequire(import.meta.url)
const { default: Eth } = require('@ledgerhq/hw-app-eth') as typeof EthApp

/** A Safe transaction as protocol-kit holds it: numbers as decimal strings. */
export interface SafeTxData {
  to: string
  value: string
  data: string
  operation: number
  safeTxGas: string
  baseGas: string
  gasPrice: string
  gasToken: string
  refundReceiver: string
  nonce: number
}

/** The key that owns the Safe: a file key on testnets, a Ledger on mainnet. */
export interface SafeOwner {
  address: Address
  /** A 65-byte owner signature of the transaction's EIP-712 hash, as Safe checks it. */
  sign(chainId: number, safe: Address, tx: SafeTxData): Promise<Hex>
}

// Safe 1.4.1's EIP-712 definition, from contracts/Safe.sol.
const types = {
  EIP712Domain: [
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  SafeTx: [
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
    { name: 'operation', type: 'uint8' },
    { name: 'safeTxGas', type: 'uint256' },
    { name: 'baseGas', type: 'uint256' },
    { name: 'gasPrice', type: 'uint256' },
    { name: 'gasToken', type: 'address' },
    { name: 'refundReceiver', type: 'address' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const

function message(tx: SafeTxData) {
  return {
    to: getAddress(tx.to),
    value: BigInt(tx.value),
    data: tx.data as Hex,
    operation: tx.operation,
    safeTxGas: BigInt(tx.safeTxGas),
    baseGas: BigInt(tx.baseGas),
    gasPrice: BigInt(tx.gasPrice),
    gasToken: getAddress(tx.gasToken),
    refundReceiver: getAddress(tx.refundReceiver),
    nonce: BigInt(tx.nonce),
  }
}

/**
 * The two hashes the Ledger Ethereum app shows for a Safe transaction, "Domain hash" and "Message
 * hash" (app-ethereum, sign_message_eip712_common/common_712.c), and the safeTxHash they combine to.
 */
export function safeTxHashes(chainId: number, safe: Address, tx: SafeTxData) {
  const domain = { chainId: BigInt(chainId), verifyingContract: safe }
  return {
    domainHash: hashDomain({ domain, types }),
    messageHash: hashStruct({ data: message(tx), primaryType: 'SafeTx', types }),
    safeTxHash: hashTypedData({ domain, types, primaryType: 'SafeTx', message: message(tx) }),
  }
}

export function keyOwner(privateKey: Hex): SafeOwner {
  const account = privateKeyToAccount(privateKey)
  return {
    address: account.address,
    sign: (chainId, safe, tx) =>
      account.signTypedData({
        domain: { chainId: BigInt(chainId), verifyingContract: safe },
        types,
        primaryType: 'SafeTx',
        message: message(tx),
      }),
  }
}

/**
 * The device cannot show a Safe transaction's fields, only its two hashes, so a compromised computer
 * could swap the kill for a transaction that empties the Safe. Printing the hashes before the device
 * is asked is the owner's one check: they must match the screen character for character.
 */
export async function ledgerOwner(
  transport: Transport,
  path: string,
  tell: (line: string) => void,
): Promise<SafeOwner> {
  const app = new Eth(transport)
  const address = getAddress((await app.getAddress(path)).address)
  return {
    address,
    async sign(chainId, safe, tx) {
      const { domainHash, messageHash, safeTxHash } = safeTxHashes(chainId, safe, tx)
      tell(`The Ledger will show Domain hash:  ${domainHash}`)
      tell(`                   and Message hash: ${messageHash}`)
      tell(`(safeTxHash ${safeTxHash})`)
      tell(
        'Approve only if both match the device exactly. On any difference, reject on the device.',
      )
      const { v, r, s } = await app.signEIP712HashedMessage(
        path,
        domainHash.slice(2),
        messageHash.slice(2),
      )
      tell('Signed.')
      return serializeSignature({ r: `0x${r}`, s: `0x${s}`, v: BigInt(v) })
    },
  }
}

/** Ethereum's standard account path, the one Ledger Live uses for its first account. */
export const DEFAULT_LEDGER_PATH = "44'/60'/0'/0/0"

export async function loadLedgerOwner(
  path: string,
  tell: (line: string) => void,
): Promise<SafeOwner> {
  // Loaded only here: node-hid is a native module the key path and the tests never need.
  const { default: TransportNodeHid } = require('@ledgerhq/hw-transport-node-hid') as typeof NodeHid
  return ledgerOwner(await TransportNodeHid.create(), path, tell)
}
