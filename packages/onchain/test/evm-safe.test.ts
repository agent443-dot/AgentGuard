import { decodeFunctionData, parseAbi, type Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { contractAddress, loadEvmConfig } from '../src/evm/config.js'
import {
  allowanceCalls,
  allowanceModuleAbi,
  enableModuleCall,
  RESET_TIME_MIN,
  requireCap,
} from '../src/evm/safe.js'

const safe: Address = '0x1111111111111111111111111111111111111111'
const module: Address = '0x2222222222222222222222222222222222222222'
const hot: Address = '0x3333333333333333333333333333333333333333'
const usdc: Address = '0x4444444444444444444444444444444444444444'
const key = `0x${'ab'.repeat(32)}`

const env = (overrides: Record<string, string> = {}) => ({
  BASE_RPC_URL: 'https://sepolia.base.org',
  OWNER_PRIVATE_KEY: key,
  HOT_WALLET_ADDRESS: hot,
  DAILY_CAP: '100000000',
  ...overrides,
})

describe('the Safe transaction enable-allowance sends', () => {
  it('enables the module on the Safe itself', () => {
    const call = enableModuleCall(safe, module)
    expect(call.to).toBe(safe)
    const abi = parseAbi(['function enableModule(address module)'])
    expect(decodeFunctionData({ abi, data: call.data }).args).toEqual([module])
  })

  it('adds the hot wallet as delegate, then caps it per day on USDC alone', () => {
    const [add, set] = allowanceCalls(module, hot, usdc, 100_000_000n)
    expect(add?.to).toBe(module)
    expect(decodeFunctionData({ abi: allowanceModuleAbi, data: add!.data })).toEqual({
      functionName: 'addDelegate',
      args: [hot],
    })
    expect(decodeFunctionData({ abi: allowanceModuleAbi, data: set!.data })).toEqual({
      functionName: 'setAllowance',
      args: [hot, usdc, 100_000_000n, RESET_TIME_MIN, 0],
    })
    expect(RESET_TIME_MIN).toBe(24 * 60)
  })
})

describe('requireCap', () => {
  it.each([[1n], [2n ** 96n - 1n]])('accepts %s', (cap) => {
    expect(requireCap(cap)).toBe(cap)
  })

  // uint96 is what the module stores; a larger cap would be truncated, not refused, by the encoder.
  it.each([[0n], [2n ** 96n]])('refuses %s', (cap) => {
    expect(() => requireCap(cap)).toThrow(/cap must be/)
  })
})

describe('loadEvmConfig', () => {
  it('defaults to Base Sepolia', () => {
    expect(loadEvmConfig(env()).BASE_CHAIN_ID).toBe('84532')
  })

  // The EVM counterpart of the Ledger rule on Solana: no raw owner key ever controls a mainnet Safe.
  it('refuses Base mainnet while the owner signs with a raw key', () => {
    expect(() => loadEvmConfig(env({ BASE_CHAIN_ID: '8453' }))).toThrow(
      /mainnet needs a hardware owner signer/,
    )
  })

  it('names the bad field and never echoes the key', () => {
    const bad = env({ OWNER_PRIVATE_KEY: `${key}00`, HOT_WALLET_ADDRESS: 'nope' })
    expect(() => loadEvmConfig(bad)).toThrow(/OWNER_PRIVATE_KEY, HOT_WALLET_ADDRESS/)
    try {
      loadEvmConfig(bad)
    } catch (error) {
      expect(String(error)).not.toContain('abab')
    }
  })
})

// Base mainnet has no verified address in shared yet; the scripts accept it only with a Ledger owner.
const mainnet = (overrides: Record<string, string> = {}) =>
  env({ BASE_CHAIN_ID: '8453', OWNER_SIGNER: 'ledger', EXECUTOR_PRIVATE_KEY: key, ...overrides })

describe('contractAddress', () => {
  it('refuses to run without a verified or configured address', () => {
    const config = loadEvmConfig(mainnet())
    expect(() => contractAddress(config, 'usdc')).toThrow(/BASE_USDC/)
  })

  it('takes the verified Base Sepolia USDC from shared over the .env one', () => {
    const config = loadEvmConfig(env({ BASE_USDC: usdc }))
    expect(contractAddress(config, 'usdc')).toEqual({
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      source: 'shared/addresses.ts',
    })
  })

  it('takes the verified value from shared over the .env one', () => {
    const config = loadEvmConfig(env({ BASE_ALLOWANCE_MODULE: `0x${'c'.repeat(40)}` }))
    expect(contractAddress(config, 'allowanceModule')).toEqual({
      address: '0xAA46724893dedD72658219405185Fb0Fc91e091C',
      source: 'shared/addresses.ts',
    })
  })

  it('takes the .env value only where shared has none, and says so', () => {
    const config = loadEvmConfig(mainnet({ BASE_USDC: usdc.toLowerCase() }))
    expect(contractAddress(config, 'usdc')).toEqual({ address: usdc, source: '.env' })
  })
})
