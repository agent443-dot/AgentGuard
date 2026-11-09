import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  type Address,
  type PublicClient,
} from 'viem'
import { z } from 'zod'
import { EXPIRED, expired, issued, problems } from '../link.js'
import { unreadable } from '../proof.js'
import { button, link, show, waitFor } from '../view.js'
import { openInPhantom } from '../wallet.js'
import { prepareEvmCreate } from './create.js'
import { prepareEvmEnable } from './enable.js'
import { prepareEvmKill } from './kill.js'
import type { EvmPlan } from './plan.js'
import { proveEvm } from './proof.js'
import { onChain, phantomEvm, type Eip1193 } from './wallet.js'

/** What the build fixed for one EVM chain: its id, the module, the dollar token, the hot wallet. */
export interface EvmChain {
  name: string
  chainId: number
  rpc: string
  module: Address
  usd: Address
  symbol: string
  hot?: Address
}

declare const MAX_DAILY_CAP: string

const address = z
  .string()
  .refine((value) => isAddress(value), 'not an EVM address')
  .transform((value) => getAddress(value))
// `hot` is optional, and only ever checked against the hot wallet the page was built for.
const hot = address.optional()
const evmLink = z.discriminatedUnion('action', [
  z.object({ action: z.literal('kill'), safe: address, hot, issued }),
  z.object({ action: z.literal('create') }),
  z.object({ action: z.literal('proof'), safe: address }),
  z.object({
    action: z.literal('enable'),
    safe: address,
    hot,
    amount: z
      .string()
      .regex(/^[1-9]\d{0,19}$/, 'a positive whole number of base units')
      .transform(BigInt)
      .refine(
        (amount) => amount <= BigInt(MAX_DAILY_CAP),
        `above this page's maximum daily cap of ${MAX_DAILY_CAP} base units`,
      ),
  }),
])
type EvmLink = z.infer<typeof evmLink>

const refuse = (reason: string): EvmPlan => ({ kind: 'refused', reason })

export async function evmMain(query: Record<string, string>, chain: EvmChain) {
  const parsed = evmLink.safeParse(query)
  if (!parsed.success) {
    show('This link is not valid', [problems(parsed.error)], 'stop')
    return
  }
  const client = createPublicClient({ transport: http(chain.rpc) }) as PublicClient
  const proving = parsed.data.action === 'proof'
  if ((await client.getChainId()) !== chain.chainId) {
    const reason = `This page's RPC for ${chain.name} serves another chain.`
    show(proving ? 'Not verified' : 'Nothing to sign', [reason], 'stop')
    return
  }
  if (parsed.data.action === 'proof') {
    await prove(client, chain, parsed.data.safe)
    return
  }
  const wallet = phantomEvm()
  if (!wallet) {
    show('Open this page in Phantom', ['No Phantom wallet was found in this browser.'], 'stop')
    link('Open in Phantom', openInPhantom(location.href))
    return
  }
  const [account] = z
    .array(address)
    .min(1)
    .parse(await wallet.request({ method: 'eth_requestAccounts' }))
  if (!(await onChain(wallet, chain.chainId))) {
    const reason = `Phantom did not switch to ${chain.name} (chain ${chain.chainId}).`
    show('Nothing to sign', [reason], 'stop')
    return
  }
  show('Checking the chain…', [])
  await run(client, wallet, account!, await prepare(client, chain, parsed.data, account!))
}

/** Read-only: anyone can open it, with no wallet, and nothing on the way asks for a signature. */
async function prove(client: PublicClient, chain: EvmChain, safe: Address) {
  if (!chain.hot) {
    show('Not verified', [`This page knows no hot wallet for ${chain.name}.`], 'stop')
    return
  }
  show('Reading the chain…', [])
  const { module, usd, symbol } = chain
  const hot = getAddress(chain.hot)
  const proof = await proveEvm(client, {
    cluster: chain.name,
    safe,
    hot,
    module,
    usd,
    symbol,
  }).catch(unreadable)
  show(proof.title, proof.lines, proof.verified ? 'done' : 'stop')
}

function prepare(
  client: PublicClient,
  chain: EvmChain,
  request: Exclude<EvmLink, { action: 'proof' }>,
  owner: Address,
): Promise<EvmPlan> {
  if (request.action === 'create') {
    return prepareEvmCreate(client, chain.name, owner)
  }
  if (request.action === 'kill' && expired(request.issued)) {
    return Promise.resolve(refuse(EXPIRED))
  }
  const hot = chain.hot && getAddress(chain.hot)
  if (!hot) {
    return Promise.resolve(refuse(`This page knows no hot wallet for ${chain.name}.`))
  }
  if (request.hot && request.hot !== hot) {
    return Promise.resolve(
      refuse(
        `The link names ${request.hot} as the hot wallet, but this page only acts for ${hot}. ` +
          'Do not sign anything from this link.',
      ),
    )
  }
  const { module, usd, symbol } = chain
  const known = { cluster: chain.name, safe: request.safe, hot, module, usd }
  return request.action === 'kill'
    ? prepareEvmKill(client, known, owner)
    : prepareEvmEnable(client, { ...known, symbol, amount: request.amount }, owner)
}

async function run(client: PublicClient, wallet: Eip1193, owner: Address, plan: EvmPlan) {
  if (plan.kind === 'refused') {
    show('Nothing to sign', [plan.reason], 'stop')
    return
  }
  if (plan.kind === 'done') {
    show(plan.title, plan.summary, 'done')
    return
  }
  // The exact call Phantom will send, from the owner: the Safe takes its approval only from them.
  try {
    await client.call({ account: owner, to: plan.to, data: plan.data })
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error)
    show('Nothing to sign', [`The chain would refuse this transaction: ${reason}`], 'stop')
    return
  }
  show(plan.title, plan.summary)
  try {
    await wallet.request({
      method: 'eth_sendTransaction',
      params: [{ from: owner, to: plan.to, data: plan.data, value: '0x0' }],
    })
  } catch (error) {
    show(plan.title, [...plan.summary, `Not sent: ${String(error)}`], 'stop')
    button('Ask Phantom again', () => void run(client, wallet, owner, plan))
    return
  }
  show('Waiting for the chain…', plan.summary)
  await waitFor(plan)
}
