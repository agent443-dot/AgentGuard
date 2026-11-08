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
import { openInPhantom } from '../wallet.js'
import { button, link, show, waitFor } from '../view.js'
import { prepareEvmKill } from './kill.js'
import type { EvmPlan } from './plan.js'
import { onChain, phantomEvm, type Eip1193 } from './wallet.js'

/** What the build fixed for one EVM chain: its id, the module, the dollar token, the hot wallet. */
export interface EvmChain {
  name: string
  chainId: number
  rpc: string
  module: Address
  usd: Address
  hot?: Address
}

const address = z
  .string()
  .refine((value) => isAddress(value), 'not an EVM address')
  .transform((value) => getAddress(value))
// `hot` is optional, and only ever checked against the hot wallet the page was built for.
const evmLink = z.object({
  action: z.literal('kill'),
  safe: address,
  hot: address.optional(),
  issued,
})

export async function evmMain(query: Record<string, string>, chain: EvmChain) {
  const parsed = evmLink.safeParse(query)
  if (!parsed.success) {
    show('This link is not valid', [problems(parsed.error)], 'stop')
    return
  }
  if (expired(parsed.data.issued)) {
    show('Nothing to sign', [EXPIRED], 'stop')
    return
  }
  const hot = chain.hot && getAddress(chain.hot)
  if (!hot) {
    show('Nothing to sign', [`This page knows no hot wallet for ${chain.name}.`], 'stop')
    return
  }
  if (parsed.data.hot && parsed.data.hot !== hot) {
    show(
      'Nothing to sign',
      [
        `The link names ${parsed.data.hot} as the hot wallet, but this page only kills ${hot}. ` +
          'Do not sign anything from this link.',
      ],
      'stop',
    )
    return
  }
  const wallet = phantomEvm()
  if (!wallet) {
    show('Open this page in Phantom', ['No Phantom wallet was found in this browser.'], 'stop')
    link('Open in Phantom', openInPhantom(location.href))
    return
  }
  const client = createPublicClient({ transport: http(chain.rpc) }) as PublicClient
  if ((await client.getChainId()) !== chain.chainId) {
    show('Nothing to sign', [`This page's RPC for ${chain.name} serves another chain.`], 'stop')
    return
  }
  const [account] = z
    .array(address)
    .min(1)
    .parse(await wallet.request({ method: 'eth_requestAccounts' }))
  if (!(await onChain(wallet, chain.chainId))) {
    show(
      'Nothing to sign',
      [`Phantom did not switch to ${chain.name} (chain ${chain.chainId}).`],
      'stop',
    )
    return
  }
  show('Checking the chain…', [])
  const plan = await prepareEvmKill(
    client,
    { safe: parsed.data.safe, hot, cluster: chain.name, module: chain.module, usd: chain.usd },
    account!,
  )
  await run(client, wallet, account!, plan)
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
  // The Safe takes the owner's approval only from the owner, so this is the exact call Phantom sends.
  try {
    await client.call({ account: owner, to: plan.safe, data: plan.data })
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error)
    show('Nothing to sign', [`The Safe would refuse this transaction: ${reason}`], 'stop')
    return
  }
  show(plan.title, plan.summary)
  try {
    await wallet.request({
      method: 'eth_sendTransaction',
      params: [{ from: owner, to: plan.safe, data: plan.data, value: '0x0' }],
    })
  } catch (error) {
    show(plan.title, [...plan.summary, `Not sent: ${String(error)}`], 'stop')
    button('Ask Phantom again', () => void run(client, wallet, owner, plan))
    return
  }
  show('Waiting for the chain…', plan.summary)
  await waitFor(plan)
}
