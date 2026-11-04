import { createEvmAdapter, createSvmAdapter, type ChainAdapter } from '@agentguard/onchain'
import type { ChainId } from '@agentguard/shared'
import { CHAINS, getAddress, requireAddress } from '@agentguard/shared'
import { readKeypairFile } from './adapters/keypair.js'
import { StubChain } from './adapters/stub.js'
import type { Config } from './config.js'

/**
 * One adapter per configured chain. A chain that is switched on with a value missing stops the
 * start rather than running without it: a guard that quietly drops a chain looks healthy and pays
 * nothing, or worse, is fixed later by someone guessing.
 */
export async function buildChains(config: Config): Promise<Map<ChainId, ChainAdapter>> {
  const chains = new Map<ChainId, ChainAdapter>()
  if (config.GUARD_STUB_CHAINS === 'true') {
    chains.set(config.SOLANA_CHAIN, new StubChain(config.SOLANA_CHAIN, 100_000_000n))
    return chains
  }

  if (config.SOLANA_HOT_WALLET_KEYPAIR !== undefined) {
    const { SOLANA_RPC_URL: rpcUrl, SQUADS_MULTISIG: multisig } = required({
      SOLANA_RPC_URL: config.SOLANA_RPC_URL,
      SQUADS_MULTISIG: config.SQUADS_MULTISIG,
    })
    const chain = config.SOLANA_CHAIN
    chains.set(
      chain,
      createSvmAdapter({
        chain,
        rpcUrl,
        hotWalletSecretKey: await readKeypairFile(config.SOLANA_HOT_WALLET_KEYPAIR),
        multisig,
        mint: requireAddress(chain, 'usdc'),
      }),
    )
  }

  if (config.BASE_CHAIN !== undefined) {
    const chain = config.BASE_CHAIN
    // A verified address in shared wins; the env value is only for a chain shared has none for.
    const values = required({
      BASE_RPC_URL: config.BASE_RPC_URL,
      SAFE_ADDRESS: config.SAFE_ADDRESS,
      HOT_WALLET_PRIVATE_KEY: config.HOT_WALLET_PRIVATE_KEY,
      BASE_USDC: getAddress(chain, 'usdc') ?? config.BASE_USDC,
      BASE_ALLOWANCE_MODULE: getAddress(chain, 'allowanceModule') ?? config.BASE_ALLOWANCE_MODULE,
    })
    chains.set(
      chain,
      createEvmAdapter({
        chain: chain === CHAINS.base ? '8453' : '84532',
        rpcUrl: values.BASE_RPC_URL,
        // The config schema has already checked it is 0x and 64 hex digits.
        hotWalletKey: values.HOT_WALLET_PRIVATE_KEY as `0x${string}`,
        safe: values.SAFE_ADDRESS,
        usdc: values.BASE_USDC,
        module: values.BASE_ALLOWANCE_MODULE,
      }),
    )
  }
  return chains
}

/** Every value, or an error naming the absent ones. Names only: one of them is a private key. */
function required<T extends Record<string, string | undefined>>(
  values: T,
): { [K in keyof T]: string } {
  const absent = Object.keys(values).filter((name) => values[name] === undefined)
  if (absent.length > 0) {
    throw new Error(`invalid configuration: ${absent.join(', ')}`)
  }
  return values as { [K in keyof T]: string }
}
