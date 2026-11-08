import { CHAINS, getAddress as sharedAddress } from '@agentguard/shared'
import {
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  parseAbi,
  size,
  slice,
  zeroAddress,
  type Hex,
} from 'viem'
import { describe, expect, it } from 'vitest'
import { allowanceCalls, allowanceModuleAbi } from '../src/evm/safe.js'
import { csp, evmChains, rpcUrls } from '../web/build.js'
import {
  createData,
  enableData,
  FALLBACK_HANDLER,
  killData,
  MULTI_SEND_CALL_ONLY,
  preValidated,
  SAFE_L2,
  safeAbi,
} from '../web/src/evm/calls.js'

const owner = getAddress('0x0000000000000000000000000000000000000E0E')
const hot = getAddress('0x0000000000000000000000000000000000000B0B')
const module = getAddress(sharedAddress(CHAINS.robinhoodTestnet, 'allowanceModule')!)
const usd = getAddress(sharedAddress(CHAINS.robinhoodTestnet, 'usd')!)
const cap = 20_000_000n
const allowance = { module, hot, usd, cap }
// Where the factory puts createData(owner, 1n): CREATE2 depends only on the factory, the proxy code,
// the initializer and the salt, so it is the same on every chain. SigningPage.t.sol checks it.
const safe = getAddress('0xE0f814d1D102ECa19737Fa20610ff2fA8226Bb20')
const factoryAbi = parseAbi([
  'function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address proxy)',
])
const multiSendAbi = parseAbi(['function multiSend(bytes transactions) payable'])
const enableAbi = parseAbi(['function enableModule(address module)'])

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

  it('creates a 1-of-1 Safe through the canonical factory, with the 1.4.1 fallback handler', () => {
    const { functionName, args } = decodeFunctionData({
      abi: factoryAbi,
      data: createData(owner, 7n),
    })
    expect(functionName).toBe('createProxyWithNonce')
    const [singleton, initializer, salt] = args
    expect([singleton, salt]).toEqual([SAFE_L2, 7n])
    expect(decodeFunctionData({ abi: safeAbi, data: initializer }).args).toEqual([
      [owner],
      1n,
      zeroAddress,
      '0x',
      FALLBACK_HANDLER,
      zeroAddress,
      0n,
      zeroAddress,
    ])
  })

  it('enables through MultiSendCallOnly only, by delegatecall, with the three calls in order', () => {
    const decoded = decodeFunctionData({
      abi: safeAbi,
      data: enableData(owner, safe, allowance, false),
    })
    const [to, , data, operation] = decoded.args as readonly unknown[]
    expect([to, operation]).toEqual([MULTI_SEND_CALL_ONLY, 1])
    const { args } = decodeFunctionData({ abi: multiSendAbi, data: data as Hex })
    expect(unpack(args[0])).toEqual([
      {
        to: safe,
        data: encodeFunctionData({ abi: enableAbi, functionName: 'enableModule', args: [module] }),
      },
      ...allowanceCalls(module, hot, usd, cap).map(({ to, data }) => ({ to, data })),
    ])
    const again = decodeFunctionData({
      abi: safeAbi,
      data: enableData(owner, safe, allowance, true),
    })
    expect(
      unpack(decodeFunctionData({ abi: multiSendAbi, data: again.args[2] as Hex }).args[0]),
    ).toHaveLength(2)
  })

  // forge/SigningPage.t.sol sends these exact bytes to the real contracts on a Robinhood fork. Update
  // with `vitest -u` when a builder changes.
  it('matches the bytes the forge fork test runs', async () => {
    const fixture = {
      owner,
      hot,
      module,
      usd,
      cap: cap.toString(),
      salt: '1',
      safe,
      create: createData(owner, 1n),
      enable: enableData(owner, safe, allowance, false),
      kill: killData(owner, module, hot),
      reenable: enableData(owner, safe, allowance, true),
    }
    await expect(`${JSON.stringify(fixture, null, 2)}\n`).toMatchFileSnapshot(
      '../forge/fixtures/signing-page.json',
    )
  })
})

/** MultiSend's packed list: operation, to, value, data length, data, one after another. */
function unpack(packed: Hex) {
  const calls: { to: string; data: Hex }[] = []
  for (let at = 0; at < size(packed);) {
    const length = Number(BigInt(slice(packed, at + 53, at + 85)))
    expect(slice(packed, at, at + 1)).toBe('0x00')
    calls.push({
      to: getAddress(slice(packed, at + 1, at + 21)),
      data: slice(packed, at + 85, at + 85 + length),
    })
    at += 85 + length
  }
  return calls
}

describe('the EVM clusters the page is built for', () => {
  it("are Robinhood's, with the module and USDG from shared", () => {
    expect(evmChains({})).toEqual({
      'robinhood-testnet': {
        chainId: 46630,
        module,
        usd: sharedAddress(CHAINS.robinhoodTestnet, 'usd'),
        symbol: 'USDG',
      },
      robinhood: {
        chainId: 4663,
        module: sharedAddress(CHAINS.robinhood, 'allowanceModule'),
        usd: sharedAddress(CHAINS.robinhood, 'usd'),
        symbol: 'USDG',
      },
    })
  })

  it('add the local stand-in only when its RPC is set, as testnet', () => {
    const chains = evmChains({ EVM_LOCALNET_RPC: 'http://127.0.0.1:1/evm-rpc' })
    expect(chains['evm-localnet']).toEqual(chains['robinhood-testnet'])
  })

  it('take each hot wallet from the build, and refuse one that is not an address', () => {
    expect(evmChains({ ROBINHOOD_HOT_WALLET_TESTNET: hot })['robinhood-testnet'].hot).toBe(hot)
    expect(() => evmChains({ ROBINHOOD_HOT_WALLET_MAINNET: '0x12' })).toThrow(
      'ROBINHOOD_HOT_WALLET_MAINNET is not an EVM address',
    )
  })

  it('may reach their RPCs, and only those', () => {
    const policy = csp(rpcUrls({}))
    expect(policy).toContain('https://rpc.testnet.chain.robinhood.com')
    expect(policy).toContain('https://rpc.mainnet.chain.robinhood.com')
  })
})
