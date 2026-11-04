import { createRequire } from 'node:module'
import type SafeModule from '@safe-global/protocol-kit'
import { recoverTypedDataAddress, type Address, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { loadEvmConfig } from '../src/evm/config.js'
import { keyOwner, ledgerOwner, safeTxHashes, type SafeTxData } from '../src/evm/owner.js'
import { fakeEthLedger } from './evm-ledger.js'

const require = createRequire(import.meta.url)
const { calculateSafeTransactionHash } =
  require('@safe-global/protocol-kit') as typeof SafeModule & {
    calculateSafeTransactionHash: (
      safe: string,
      tx: SafeTxData,
      version: string,
      chainId: bigint,
    ) => string
  }

const safe: Address = '0x5afe00000000000000000000000000000000cafe'
const zero = '0x0000000000000000000000000000000000000000'
// The kill, as buildKillTx builds it: removeDelegate(hot, true) on the module.
const kill: SafeTxData = {
  to: '0xAA46724893dedD72658219405185Fb0Fc91e091C',
  value: '0',
  data:
    '0xdbd61e110000000000000000000000001111111111111111111111111111111111111111' +
    '0000000000000000000000000000000000000000000000000000000000000001',
  operation: 0,
  safeTxGas: '0',
  baseGas: '0',
  gasPrice: '0',
  gasToken: zero,
  refundReceiver: zero,
  nonce: 3,
}

async function recover(chainId: number, signature: Hex) {
  return recoverTypedDataAddress({
    domain: { chainId, verifyingContract: safe },
    types: {
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
    },
    primaryType: 'SafeTx',
    message: { ...kill, value: 0n, safeTxGas: 0n, baseGas: 0n, gasPrice: 0n, nonce: 3n } as never,
    signature,
  })
}

describe('safeTxHashes', () => {
  it('matches the hash protocol-kit computes for Safe 1.4.1', () => {
    const { safeTxHash } = safeTxHashes(8453, safe, kill)
    expect(safeTxHash).toBe(calculateSafeTransactionHash(safe, kill, '1.4.1', 8453n))
  })

  it('changes with the chain, so a signature cannot be replayed across chains', () => {
    expect(safeTxHashes(8453, safe, kill).safeTxHash).not.toBe(
      safeTxHashes(84532, safe, kill).safeTxHash,
    )
  })
})

describe('the owner on a Ledger', () => {
  it('signs the Safe transaction so that it recovers to the device address', async () => {
    const owner = await ledgerOwner(fakeEthLedger(), "44'/60'/0'/0/0", () => {})
    const signature = await owner.sign(8453, safe, kill)
    expect(await recover(8453, signature)).toBe(owner.address)
  })

  it('prints the two hashes the device shows, before the device is asked', async () => {
    const device = fakeEthLedger()
    const told: string[] = []
    const owner = await ledgerOwner(device, "44'/60'/0'/0/0", (line) => told.push(line))
    await owner.sign(8453, safe, kill)
    const [shown] = device.shown
    // Exactly as on screen, 0x and uppercase, so a character-for-character comparison passes.
    expect(shown!.domainHash).toMatch(/^0x[0-9A-F]{64}$/)
    expect(told[1]).toBe(`The Ledger will show Domain hash:  ${shown!.domainHash}`)
    expect(told[2]).toBe(`                   and Message hash: ${shown!.messageHash}`)
    expect(told[3]).toContain(safeTxHashes(8453, safe, kill).safeTxHash)
  })

  it('says to turn Blind signing on when the app refuses, and off once it has signed', async () => {
    const device = fakeEthLedger()
    const told: string[] = []
    const owner = await ledgerOwner(device, "44'/60'/0'/0/0", (line) => told.push(line))
    device.blindSigning = false
    await expect(owner.sign(8453, safe, kill)).rejects.toThrow(/Turn Blind signing on/)
    expect(device.shown).toEqual([])
    device.blindSigning = true
    await owner.sign(8453, safe, kill)
    expect(told.at(-1)).toMatch(/Turn Blind signing off again/)
  })

  it('uses one account per derivation path', async () => {
    const first = await ledgerOwner(fakeEthLedger(), "44'/60'/0'/0/0", () => {})
    const second = await ledgerOwner(fakeEthLedger(), "44'/60'/0'/0/1", () => {})
    expect(first.address).not.toBe(second.address)
  })
})

describe('the owner as a key', () => {
  it('signs the same EIP-712 transaction', async () => {
    const owner = keyOwner(`0x${'22'.repeat(32)}`)
    expect(await recover(84532, await owner.sign(84532, safe, kill))).toBe(owner.address)
  })
})

describe('loadEvmConfig and the owner signer', () => {
  const env = (overrides: Record<string, string>) => ({
    BASE_RPC_URL: 'https://mainnet.base.org',
    HOT_WALLET_ADDRESS: '0x3333333333333333333333333333333333333333',
    DAILY_CAP: '100000000',
    ...overrides,
  })
  const key = `0x${'ab'.repeat(32)}`

  it('allows Base mainnet with the owner on a Ledger', () => {
    const config = loadEvmConfig(
      env({ BASE_CHAIN_ID: '8453', OWNER_SIGNER: 'ledger', EXECUTOR_PRIVATE_KEY: key }),
    )
    expect(config.OWNER_LEDGER_PATH).toBe("44'/60'/0'/0/0")
  })

  it('still refuses Base mainnet with a raw owner key', () => {
    expect(() => loadEvmConfig(env({ BASE_CHAIN_ID: '8453', OWNER_PRIVATE_KEY: key }))).toThrow(
      /hardware owner signer/,
    )
  })

  it('needs a gas-paying executor key with a Ledger', () => {
    expect(() => loadEvmConfig(env({ OWNER_SIGNER: 'ledger' }))).toThrow(/EXECUTOR_PRIVATE_KEY/)
  })

  it('needs the owner key without one', () => {
    expect(() => loadEvmConfig(env({}))).toThrow(/OWNER_PRIVATE_KEY/)
  })

  it('refuses a derivation path outside Ethereum', () => {
    const bad = env({
      OWNER_SIGNER: 'ledger',
      EXECUTOR_PRIVATE_KEY: key,
      OWNER_LEDGER_PATH: "44'/501'/0'",
    })
    expect(() => loadEvmConfig(bad)).toThrow(/OWNER_LEDGER_PATH/)
  })
})
