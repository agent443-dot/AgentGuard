import './shim.js'
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { z } from 'zod'
import { prepareCreate } from './create.js'
import { prepareKill } from './kill.js'
import { prepareLimit } from './limit.js'
import { isPublicKey, type Plan } from './plan.js'
import { openInPhantom, phantom, type Wallet } from './wallet.js'

declare const RPC_URLS: Record<string, string>
declare const USDC_MINTS: Record<string, string>
declare const HOT_WALLETS: Record<string, string>
declare const MAX_DAILY_CAP: string

/** A build-time value for the cluster, by its own name only. */
const built = (map: Record<string, string>, cluster: string) =>
  Object.hasOwn(map, cluster) ? map[cluster] : undefined

const app = document.getElementById('app')!

function show(title: string, lines: string[], tone: 'info' | 'stop' | 'done' = 'info') {
  app.replaceChildren()
  app.dataset['state'] = tone
  const heading = document.createElement('h1')
  heading.textContent = title
  app.append(heading)
  for (const line of lines) {
    const p = document.createElement('p')
    p.textContent = line
    app.append(p)
  }
}

function button(label: string, action: () => void) {
  const element = document.createElement('button')
  element.textContent = label
  element.addEventListener('click', action, { once: true })
  app.append(element)
}

const key = z
  .string()
  .refine(isPublicKey, 'not a Solana address')
  .transform((value) => new PublicKey(value))
// Own names only: `in` would also accept inherited ones such as toString.
const cluster = z.string().refine((name) => Object.hasOwn(RPC_URLS, name), 'unknown cluster')
const link = z.discriminatedUnion('action', [
  z.object({ action: z.literal('kill'), cluster, multisig: key, hot: key }),
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

function prepare(connection: Connection, owner: PublicKey, request: z.infer<typeof link>) {
  switch (request.action) {
    case 'kill':
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
  const parsed = link.safeParse(Object.fromEntries(new URLSearchParams(location.search)))
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    show('This link is not valid', [issues.join('; ')], 'stop')
    return
  }
  const wallet = phantom()
  if (!wallet) {
    show('Open this page in Phantom', ['No Phantom wallet was found in this browser.'], 'stop')
    const open = document.createElement('a')
    open.href = openInPhantom(location.href)
    open.textContent = 'Open in Phantom'
    app.append(open)
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
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await plan.landed()
    if (result) {
      show(plan.after, result, 'done')
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  show(
    'Not confirmed yet',
    ['The change is not on the chain yet. Run status before trying again.'],
    'stop',
  )
}

main().catch((error: unknown) => show('Something went wrong', [String(error)], 'stop'))
