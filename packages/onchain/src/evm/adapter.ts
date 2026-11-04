import {
  USDC_DECIMALS,
  type Address as TokenAddress,
  type AllowanceState,
  type Amount,
  type ChainId,
  type PayIntent,
  type RejectCode,
  type TxId,
} from '@agentguard/shared'
import type { PaymentRequirements, SchemeNetworkClient } from '@x402/core/types'
import { ExactEvmScheme } from '@x402/evm'
import { privateKeyToAccount } from 'viem/accounts'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  parseAbi,
  zeroAddress,
  type Account,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from 'viem'
import {
  SigningRefused,
  type ChainAdapter,
  type KillTx,
  type SimulationOutcome,
} from '../ChainAdapter.js'
import { formatUnits } from '../svm/transfer.js'
import { chainOf } from './config.js'
import { checkTypedData } from './gate.js'
import { allowanceModuleAbi, readAllowance } from './safe.js'

export interface EvmAdapterDeps {
  chain: ChainId
  client: PublicClient
  /** Holds the hot wallet account; guard-core alone has its key. */
  wallet: WalletClient & { account: Account }
  safe: Address
  usdc: Address
  module: Address
  /** Unix seconds; injectable so the signing gate can be tested at a fixed time. */
  now?: () => bigint
}

/** The same adapter from plain values, so guard-core never handles a viem type. */
export function createEvmAdapter(config: {
  chain: '84532' | '8453'
  rpcUrl: string
  hotWalletKey: Hash
  safe: string
  usdc: string
  module: string
}): ChainAdapter {
  const chain = chainOf(config.chain)
  const transport = http(config.rpcUrl)
  return evmAdapter({
    chain: `eip155:${config.chain}`,
    client: createPublicClient({ chain, transport }) as PublicClient,
    wallet: createWalletClient({
      account: privateKeyToAccount(config.hotWalletKey),
      chain,
      transport,
    }),
    safe: getAddress(config.safe),
    usdc: getAddress(config.usdc),
    module: getAddress(config.module),
  })
}

const erc20Abi = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
])
const executeAbi = parseAbi([
  'function executeAllowanceTransfer(address safe, address token, address to, uint96 amount, address paymentToken, uint96 payment, address delegate, bytes signature)',
])

const NOT_SIMULATED = { summary: 'not simulated', balanceChanges: [] }

function atomic(amount: Amount): bigint {
  if (!/^[1-9]\d*$/.test(amount)) {
    throw new Error(`invalid_amount: ${amount}`)
  }
  return BigInt(amount)
}

export function evmAdapter(deps: EvmAdapterDeps): ChainAdapter {
  const { chain, client, wallet, safe, usdc, module } = deps
  const hot = wallet.account.address
  const now = deps.now ?? (() => BigInt(Math.floor(Date.now() / 1000)))

  function refuse(intent: PayIntent): RejectCode[] {
    if (intent.chain !== chain) {
      return ['CHAIN_NOT_ALLOWED']
    }
    if (!isAddress(intent.token) || getAddress(intent.token) !== usdc) {
      return ['TOKEN_NOT_ALLOWED']
    }
    return []
  }

  async function confirmed(hash: Hash): Promise<TxId> {
    const receipt = await client.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`transaction_failed: ${hash}`)
    }
    return hash
  }

  const balanceOf = (owner: Address) =>
    ({ to: usdc, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }) as const

  return {
    chain,

    async getAllowanceState(): Promise<AllowanceState> {
      const state = await readAllowance(client, module, safe, hot, usdc)
      const resetsAtMin = state.lastResetMin + state.resetTimeMin
      return {
        cap: state.amount.toString(),
        spent: state.spent.toString(),
        resetsAt: new Date(Number(resetsAtMin) * 60_000).toISOString(),
        delegate: hot,
      }
    },

    async getHotWalletBalance(token: TokenAddress): Promise<Amount> {
      const balance = await client.readContract({
        address: getAddress(token),
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [hot],
      })
      return balance.toString()
    },

    async topUpHotWallet(amount: Amount): Promise<TxId> {
      // An empty signature makes the module authenticate the delegate as the caller.
      const hash = await wallet.writeContract({
        chain: client.chain,
        account: wallet.account,
        address: module,
        abi: executeAbi,
        functionName: 'executeAllowanceTransfer',
        args: [safe, usdc, hot, atomic(amount), zeroAddress, 0n, hot, '0x'],
      })
      return confirmed(hash)
    },

    async simulate(intent: PayIntent): Promise<SimulationOutcome> {
      const refused = refuse(intent)
      if (refused.length > 0 || !isAddress(intent.recipient)) {
        return {
          simulation: NOT_SIMULATED,
          rejectReasons: refused.length ? refused : ['SIM_FAILED'],
        }
      }
      let amount: bigint
      try {
        amount = atomic(intent.amount)
      } catch {
        return { simulation: NOT_SIMULATED, rejectReasons: ['SIM_FAILED'] }
      }
      const to = getAddress(intent.recipient)
      const simulation = {
        summary: `pays ${formatUnits(amount, USDC_DECIMALS)} USDC from ${hot} to ${to}`,
        balanceChanges: [{ token: usdc, delta: (-amount).toString() }],
      }
      // One simulated block, so the balances before and after are read against the same state.
      const [block] = await client.simulateBlocks({
        blocks: [
          {
            calls: [
              balanceOf(hot),
              balanceOf(to),
              { account: hot, to: usdc, data: transferData(to, amount) },
              balanceOf(hot),
              balanceOf(to),
            ],
          },
        ],
      })
      const results = block?.calls ?? []
      if (results.length !== 5 || results.some((call) => call.status !== 'success')) {
        return { simulation, rejectReasons: ['SIM_FAILED'] }
      }
      const [hotBefore, toBefore, , hotAfter, toAfter] = results.map((call) =>
        typeof call.result === 'bigint' ? call.result : -1n,
      )
      const exact =
        hotBefore !== undefined &&
        hotAfter === hotBefore - amount &&
        toBefore !== undefined &&
        toAfter === toBefore + amount
      return { simulation, rejectReasons: exact ? [] : ['SIM_UNEXPECTED_EFFECT'] }
    },

    async send(intent: PayIntent): Promise<TxId> {
      const refused = refuse(intent)
      if (refused.length > 0) {
        throw new Error(`send_refused: ${refused.join(',')}`)
      }
      if (!isAddress(intent.recipient)) {
        throw new Error(`send_refused: SIM_FAILED`)
      }
      const hash = await wallet.writeContract({
        chain: client.chain,
        account: wallet.account,
        address: usdc,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [getAddress(intent.recipient), atomic(intent.amount)],
      })
      return confirmed(hash)
    },

    async buildKillTx(): Promise<KillTx> {
      // removeDelegate with removeAllowances = true deletes the allowance too, so one call does both.
      const data = encodeFunctionData({
        abi: allowanceModuleAbi,
        functionName: 'removeDelegate',
        args: [hot, true],
      })
      return {
        description:
          `Remove the hot wallet ${hot} as Allowance Module delegate on Safe ${safe}, with its ` +
          `allowances. It can no longer draw from the Safe until a new allowance is set. Sign as a ` +
          `Safe owner.`,
        payload: { safe, to: module, value: '0', data, operation: 0 },
      }
    },

    x402Scheme(intent: PayIntent, requirements: PaymentRequirements): SchemeNetworkClient {
      const refused = refuse(intent)
      if (refused.length > 0) {
        throw new SigningRefused(refused)
      }
      const agreed =
        requirements.network === intent.chain &&
        isAddress(requirements.asset) &&
        getAddress(requirements.asset) === usdc &&
        isAddress(requirements.payTo) &&
        isAddress(intent.recipient) &&
        getAddress(requirements.payTo) === getAddress(intent.recipient) &&
        requirements.amount === intent.amount
      if (!agreed) {
        throw new SigningRefused(['INVALID_402'])
      }
      const expected = {
        chainId: Number(chain.split(':')[1]),
        usdc,
        from: hot,
        to: getAddress(intent.recipient),
        value: atomic(intent.amount),
      }
      // Only typed-data signing is offered: no transaction signer and no EIP-7702 authorization, so
      // the SDK's approval and delegation paths have nothing to sign with.
      return new ExactEvmScheme({
        address: hot,
        async signTypedData(typed) {
          const checked = checkTypedData(typed, { ...expected, now: now() })
          if (Array.isArray(checked)) {
            throw new SigningRefused(checked)
          }
          return wallet.signTypedData({ ...checked, account: wallet.account })
        },
      })
    },
  }
}

function transferData(to: Address, amount: bigint): Hash {
  return encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, amount] })
}
