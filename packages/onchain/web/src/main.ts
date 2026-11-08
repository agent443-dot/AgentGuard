import './shim.js'
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { z } from 'zod'
import { prepareCreate } from './create.js'
import { evmMain, type EvmChain } from './evm/main.js'
import { prepareKill } from './kill.js'
import { prepareLimit } from './limit.js'
import { EXPIRED, expired, issued, problems } from './link.js'
import { isPublicKey, type Plan } from './plan.js'
import { button, link, show, waitFor } from './view.js'
import { openInPhantom, phantom, type Wallet } from './wallet.js'

declare const RPC_URLS: Record<string, string>
declare const USDC_MINTS: Record<string, string>
declare const HOT_WALLETS: Record<string, string>
declare const MAX_DAILY_CAP: string
declare const EVM_CHAINS: Record<string, Omit<EvmChain, 'name' | 'rpc'>>

/** A build-time value for the cluster, by its own name only. */
const built = <T>(map: Record<string, T>, cluster: string) =>
  Object.hasOwn(map, cluster) ? map[cluster] : undefined

const key = z
  .string()
  .refine(isPublicKey, 'not a Solana address')
  .transform((value) => new PublicKey(value))
// Own names only: `in` would also accept inherited ones such as toString.
const cluster = z.string().refine((name) => Object.hasOwn(RPC_URLS, name), 'unknown cluster')
const solanaLink = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('kill'),
    cluster,
    multisig: key,
    hot: key,
    issued,
  }),
  z.object({ action: z.literal('create'), cluster }),
  z.object({
    action: z.literal('add-limit'),
    cluster,
    multisig: key,
    // Optional, and only ever checked against the hot wallet the page was built for.
    hot: key.optional(),
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

function prepare(connection: Connection, owner: PublicKey, request: z.infer<typeof solanaLink>) {
  switch (request.action) {
    case 'kill':
      if (expired(request.issued)) {
        return Promise.resolve<Plan>({ kind: 'refused', reason: EXPIRED })
      }
      return prepareKill(connection, { ...request, hotWallet: request.hot }, owner)
    case 'create':
      return prepareCreate(connection, request.cluster, owner)
    case 'add-limit': {
      const usdc = built(USDC_MINTS, request.cluster)
      const hot = built(HOT_WALLETS, request.cluster)
      const refuse = (reason: string) => Promise.resolve<Plan>({ kind: 'refused', reason })
      if (!usdc || !hot) {
        return refuse(`This page knows no USDC or no hot wallet for ${request.cluster}.`)
      }
      const hotWallet = new PublicKey(hot)
      if (request.hot && !request.hot.equals(hotWallet)) {
        return refuse(
          `The link names ${request.hot.toBase58()} as the hot wallet, but this page only sets the ` +
            `limit for ${hot}. Do not sign anything from this link.`,
        )
      }
      return prepareLimit(connection, { ...request, hotWallet, usdc: new PublicKey(usdc) }, owner)
    }
  }
}

async function main() {
  const query = Object.fromEntries(new URLSearchParams(location.search))
  const evm = built(EVM_CHAINS, query['cluster'] ?? '')
  if (evm) {
    await evmMain(query, { ...evm, name: query['cluster']!, rpc: RPC_URLS[query['cluster']!]! })
    return
  }
  const parsed = solanaLink.safeParse(query)
  if (!parsed.success) {
    show('This link is not valid', [problems(parsed.error)], 'stop')
    return
  }
  const wallet = phantom()
  if (!wallet) {
    show('Open this page in Phantom', ['No Phantom wallet was found in this browser.'], 'stop')
    link('Open in Phantom', openInPhantom(location.href))
    return
  }
  const connection = new Connection(RPC_URLS[parsed.data.cluster]!, 'confirmed')
  const owner = new PublicKey((await wallet.connect()).publicKey.toString())
  show('Checking the chain…', [])
  await run(connection, wallet, owner, await prepare(connection, owner, parsed.data))
}

async function run(connection: Connection, wallet: Wallet, owner: PublicKey, plan: Plan) {
  if (plan.kind === 'refused') {
    show('Nothing to sign', [plan.reason], 'stop')
    return
  }
  if (plan.kind === 'done') {
    show(plan.title, plan.summary, 'done')
    return
  }
  show(plan.title, plan.summary)
  const { blockhash } = await connection.getLatestBlockhash()
  const tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: owner,
      recentBlockhash: blockhash,
      instructions: plan.instructions,
    }).compileToV0Message(),
  )
  if (plan.coSigners.length > 0) {
    tx.sign(plan.coSigners)
  }
  try {
    await wallet.signAndSendTransaction(tx)
  } catch (error) {
    show(plan.title, [...plan.summary, `Not signed: ${String(error)}`], 'stop')
    button('Ask Phantom again', () => void run(connection, wallet, owner, plan))
    return
  }
  show('Waiting for the chain…', plan.summary)
  await waitFor(plan)
}

main().catch((error: unknown) => show('Something went wrong', [String(error)], 'stop'))
