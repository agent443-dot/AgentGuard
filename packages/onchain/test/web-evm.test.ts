import { CHAINS, getAddress as sharedAddress } from '@agentguard/shared'
import { decodeFunctionData, getAddress, size, slice, zeroAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { allowanceModuleAbi } from '../src/evm/safe.js'
import { csp, evmChains, rpcUrls } from '../web/build.js'
import { killData, preValidated, safeAbi } from '../web/src/evm/calls.js'

const owner = getAddress('0x0000000000000000000000000000000000000E0E')
const hot = getAddress('0x0000000000000000000000000000000000000B0B')
const module = getAddress(sharedAddress(CHAINS.robinhoodTestnet, 'allowanceModule')!)

describe("the signing page's Safe calls", () => {
  it('approves as the sender: r is the owner, s is zero, v is 1', () => {
    const signature = preValidated(owner)
    expect(size(signature)).toBe(65)
    expect(getAddress(slice(signature, 12, 32))).toBe(owner)
    expect(BigInt(slice(signature, 32, 64))).toBe(0n)
    expect(slice(signature, 64)).toBe('0x01')
  })

  it('kills with one plain call to the module: removeDelegate(hot, true), no refund', () => {
    const { functionName, args } = decodeFunctionData({
      abi: safeAbi,
      data: killData(owner, module, hot),
    })
    expect(functionName).toBe('execTransaction')
    const [to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refund, signature] =
      args as readonly unknown[]
    expect([to, value, operation, safeTxGas, baseGas, gasPrice, gasToken, refund]).toEqual([
      module,
      0n,
      0,
      0n,
      0n,
      0n,
      zeroAddress,
      zeroAddress,
    ])
    expect(signature).toBe(preValidated(owner))
    expect(decodeFunctionData({ abi: allowanceModuleAbi, data: data as `0x${string}` })).toEqual({
      functionName: 'removeDelegate',
      args: [hot, true],
    })
  })

  // forge/SigningPageKill.t.sol sends these exact bytes to the real Safe on a Robinhood fork. Update
  // with `vitest -u` when a builder changes.
  it('matches the bytes the forge fork test runs', async () => {
    const fixture = { owner, hot, module, kill: killData(owner, module, hot) }
    await expect(`${JSON.stringify(fixture, null, 2)}\n`).toMatchFileSnapshot(
      '../forge/fixtures/signing-page.json',
    )
  })
})

describe('the EVM clusters the page is built for', () => {
  it("are Robinhood's, with the module and USDG from shared", () => {
    expect(evmChains({})).toEqual({
      'robinhood-testnet': {
        chainId: 46630,
        module,
        usd: sharedAddress(CHAINS.robinhoodTestnet, 'usd'),
      },
      robinhood: {
        chainId: 4663,
        module: sharedAddress(CHAINS.robinhood, 'allowanceModule'),
        usd: sharedAddress(CHAINS.robinhood, 'usd'),
      },
    })
  })

  it('add the local stand-in only when its RPC is set, as testnet', () => {
    const chains = evmChains({ EVM_LOCALNET_RPC: 'http://127.0.0.1:1/evm-rpc' })
    expect(chains['evm-localnet']).toEqual(chains['robinhood-testnet'])
  })

  it('may reach their RPCs, and only those', () => {
    const policy = csp(rpcUrls({}))
    expect(policy).toContain('https://rpc.testnet.chain.robinhood.com')
    expect(policy).toContain('https://rpc.mainnet.chain.robinhood.com')
  })
})
