import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHAINS, getAddress as sharedAddress } from '@agentguard/shared'
import {
  decodeFunctionData,
  encodeErrorResult,
  encodeFunctionResult,
  getAddress,
  isAddressEqual,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'
import { z } from 'zod'
import { allowanceModuleAbi } from '../../src/evm/safe.js'
import { buildPage } from '../build.js'
import { killData, safeAbi } from '../src/evm/calls.js'
import { jsonRpc, JsonRpcError, serve } from './server.js'

export const MODULE = getAddress(sharedAddress(CHAINS.robinhoodTestnet, 'allowanceModule')!)
export const USDG = getAddress(sharedAddress(CHAINS.robinhoodTestnet, 'usd')!)
const abi = [...safeAbi, ...allowanceModuleAbi]
const call = z.object({ from: z.string().optional(), to: z.string(), data: z.string() })
const reverts = (reason: string) =>
  new JsonRpcError(
    3,
    `execution reverted: ${reason}`,
    encodeErrorResult({
      abi: parseAbi(['error Error(string)']),
      errorName: 'Error',
      args: [reason],
    }),
  )

/**
 * Robinhood testnet as the page reads it, for one Safe: its owners, the module's delegate and
 * allowance. The Safe runs only the kill this suite expects, from its owner, as the real one would
 * with a pre-validated signature; the real contracts are exercised by forge (SigningPageKill.t.sol).
 */
export async function stageEvm() {
  const state = {
    safe: getAddress('0x5afe00000000000000000000000000000000cafe'),
    owners: [getAddress('0x0e0e00000000000000000000000000000000beef')],
    threshold: 1n,
    hot: getAddress('0x0b0b00000000000000000000000000000000f00d'),
    listed: true,
    /** The Safe reverts even its owner's kill, as it would for a guard or a changed module. */
    refuses: false,
    allowance: [50_000_000n, 1_500_000n, 1440n, 29_000_000n, 3n] as const,
  }
  const sent: { from: Address; to: Address; data: Hex; value: Hex }[] = []

  function execute(from: Address | undefined, to: Address, data: Hex): Hex {
    const { functionName, args } = decodeFunctionData({ abi, data })
    const answer = (result: unknown) => encodeFunctionResult({ abi, functionName, result } as never)
    switch (functionName) {
      case 'getOwners':
        return answer(state.owners)
      case 'getThreshold':
        return answer(state.threshold)
      // The module's entries, only under the keys it really uses for this Safe and hot wallet.
      case 'delegates': {
        const [safe, key] = args as [Address, number]
        const ours =
          isAddressEqual(safe, state.safe) && key === Number(BigInt(state.hot) & 0xffffffffffffn)
        return answer([ours && state.listed ? state.hot : zeroAddress, 0, 0])
      }
      case 'getTokenAllowance': {
        const [safe, delegate, token] = args as [Address, Address, Address]
        const ours = [safe, delegate, token].every((a, i) =>
          isAddressEqual(a, [state.safe, state.hot, USDG][i]!),
        )
        return answer(ours && state.listed ? state.allowance : [0n, 0n, 0n, 0n, 0n])
      }
      case 'execTransaction': {
        const owner = state.owners[0]!
        const expected = killData(owner, MODULE, state.hot)
        if (state.refuses || !from || !isAddressEqual(from, owner) || data !== expected) {
          throw reverts('GS025')
        }
        if (!isAddressEqual(to, state.safe)) {
          throw reverts('not the Safe')
        }
        return answer(true)
      }
      default:
        throw new Error(`fake node: ${functionName} not served`)
    }
  }

  const rpc = jsonRpc({
    eth_chainId: () => '0xb626',
    eth_getCode: ([address]) =>
      isAddressEqual(z.string().parse(address) as Address, state.safe) ? '0x6080' : '0x',
    eth_call: ([request]) => {
      const { from, to, data } = call.parse(request)
      return execute(from as Address | undefined, to as Address, data as Hex)
    },
  })
  // What Phantom sends: the node runs it, and the kill takes effect.
  async function send(body: string) {
    const tx = z
      .object({ from: z.string(), to: z.string(), data: z.string(), value: z.string() })
      .parse(JSON.parse(body))
    sent.push(tx as (typeof sent)[number])
    execute(tx.from as Address, tx.to as Address, tx.data as Hex)
    state.listed = false
    return JSON.stringify(`0x${'ab'.repeat(32)}`)
  }

  const dist = await mkdtemp(join(tmpdir(), 'agentguard-sign-evm-'))
  const server = await serve(dist, { '/evm-rpc': rpc, '/evm-wallet': send })
  await buildPage(dist, {
    EVM_LOCALNET_RPC: `${server.origin}/evm-rpc`,
    EVM_HOT_WALLET_LOCALNET: state.hot,
  })
  return { state, sent, server }
}

/**
 * Phantom's EVM provider as the page sees it. It starts on another chain, so the page must switch
 * it; with `switches` false it refuses the switch, as a wallet that does not know the chain would.
 * The owner rejects the first `rejects` transactions.
 */
export function mockPhantomEvm(
  account: Address,
  { switches = true, rejects = 0 }: { switches?: boolean; rejects?: number } = {},
): string {
  return `
    window.__requests = []
    let chainId = '0x1'
    let rejects = ${rejects}
    window.phantom = { ethereum: {
      isPhantom: true,
      request: async ({ method, params }) => {
        window.__requests.push(method)
        switch (method) {
          case 'eth_requestAccounts': return [${JSON.stringify(account)}]
          case 'eth_chainId': return chainId
          case 'wallet_switchEthereumChain':
            if (!${String(switches)}) throw new Error('Unrecognized chain ID')
            chainId = params[0].chainId
            return null
          case 'eth_sendTransaction': {
            if (rejects-- > 0) throw new Error('User rejected the request.')
            const res = await fetch('/evm-wallet', { method: 'POST', body: JSON.stringify(params[0]) })
            if (!res.ok) throw new Error(await res.text())
            return res.json()
          }
          default: throw new Error('mock Phantom: ' + method)
        }
      },
    } }`
}
