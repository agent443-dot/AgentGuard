import './shim.js'
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { z } from 'zod'
import { isPublicKey, planKill, readKillState, type KillRequest } from './kill.js'
import { openInPhantom, phantom, type Wallet } from './wallet.js'

declare const RPC_URLS: Record<string, string>

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

const key = z.string().refine(isPublicKey, 'not a Solana address')
const params = z.object({
  action: z.literal('kill'),
  cluster: z.string().refine((cluster) => cluster in RPC_URLS, 'unknown cluster'),
  multisig: key,
  hot: key,
})

async function main() {
  const parsed = params.safeParse(Object.fromEntries(new URLSearchParams(location.search)))
  if (!parsed.success) {
    show(
      'This link is not valid',
      [parsed.error.issues.map((i) => `${i.path}: ${i.message}`).join('; ')],
      'stop',
    )
    return
  }
  const wallet = phantom()
  if (!wallet) {
    show('Open this page in Phantom', ['No Phantom wallet was found in this browser.'], 'stop')
    const link = document.createElement('a')
    link.href = openInPhantom(location.href)
    link.textContent = 'Open in Phantom'
    app.append(link)
    return
  }
  const request: KillRequest = {
    cluster: parsed.data.cluster,
    multisig: new PublicKey(parsed.data.multisig),
    hotWallet: new PublicKey(parsed.data.hot),
  }
  const connection = new Connection(RPC_URLS[request.cluster]!, 'confirmed')
  const owner = new PublicKey((await wallet.connect()).publicKey.toString())
  await kill(connection, wallet, request, owner)
}

async function kill(
  connection: Connection,
  wallet: Wallet,
  request: KillRequest,
  owner: PublicKey,
) {
  show('Checking the chain…', [])
  const plan = planKill(request, owner, await readKillState(connection, request))
  if (plan.kind === 'refused') {
    show('Nothing to sign', [plan.reason], 'stop')
    return
  }
  if (plan.kind === 'done') {
    show('Already killed', plan.summary, 'done')
    return
  }
  show('Kill the hot wallet', plan.summary)
  const { blockhash } = await connection.getLatestBlockhash()
  const message = new TransactionMessage({
    payerKey: owner,
    recentBlockhash: blockhash,
    instructions: [plan.instruction],
  }).compileToV0Message()
  try {
    await wallet.signAndSendTransaction(new VersionedTransaction(message))
  } catch (error) {
    show('Kill the hot wallet', [...plan.summary, `Not signed: ${String(error)}`], 'stop')
    button('Ask Phantom again', () => void kill(connection, wallet, request, owner))
    return
  }
  show('Waiting for the chain…', plan.summary)
  for (let attempt = 0; attempt < 60; attempt++) {
    const { limitInfo } = await readKillState(connection, request)
    if (!limitInfo) {
      show(
        'Killed',
        [
          `The spending limit ${plan.limit.toBase58()} is gone.`,
          'The hot wallet can no longer draw from the vault.',
        ],
        'done',
      )
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  show(
    'Not confirmed yet',
    [`The limit ${plan.limit.toBase58()} still exists. Run status before trying again.`],
    'stop',
  )
}

main().catch((error: unknown) => show('Something went wrong', [String(error)], 'stop'))
