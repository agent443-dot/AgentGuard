import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  type PublicKey,
  type TransactionInstruction,
} from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { keypairOwner } from '../../src/svm/owner.js'
import {
  addDailySpendingLimit,
  createMultisig,
  removeSpendingLimitInstruction,
  spendingLimitPda,
} from '../../src/svm/squads.js'
import { chain, plantProgramConfig, USDC, type Chain } from '../../test/fixture.js'
import { buildPage } from '../build.js'
import { mockPhantom, servePage } from './server.js'

/**
 * The kill page in a real browser, against the real Squads program in LiteSVM. Phantom is replaced
 * by a provider that hands each transaction to the test server, which records it and signs it with
 * whichever key the test connected, as the wallet would.
 */
const squads = fileURLToPath(new URL('../../test/fixtures/squads_v4.so', import.meta.url))

let c: Chain
let owner: Keypair
let connected: Keypair
let multisigPda: PublicKey
let limit: PublicKey
let server: Awaited<ReturnType<typeof servePage>>
let browser: Browser
let dist: string

beforeAll(async () => {
  browser = await chromium.launch()
  dist = await mkdtemp(join(tmpdir(), 'agentguard-sign-'))
})

afterAll(async () => {
  await browser.close()
})

beforeEach(async () => {
  c = chain()
  c.svm.addProgramFromFile(multisig.PROGRAM_ID, squads)
  plantProgramConfig(c)
  owner = Keypair.generate()
  connected = owner
  c.svm.airdrop(owner.publicKey, BigInt(10 * LAMPORTS_PER_SOL))
  const created = await createMultisig(c.connection, keypairOwner(owner))
  multisigPda = created.multisigPda
  await addDailySpendingLimit(c.connection, keypairOwner(owner), {
    multisigPda,
    createKey: c.hotWallet.publicKey,
    mint: c.mint,
    amount: 100n * USDC,
    members: [c.hotWallet.publicKey],
    destinations: [c.hotWallet.publicKey],
  })
  limit = spendingLimitPda(multisigPda, c.hotWallet.publicKey)

  if (server) {
    await server.close()
  }
  // The server's port is only known once it listens, so the page is built for it afterwards.
  server = await servePage(c.svm, dist, () => connected)
  await buildPage(dist, { SOLANA_LOCALNET_RPC: `${server.origin}/rpc` })
})

afterAll(async () => {
  await server.close()
})

async function open({ phantom = true, rejects = false } = {}): Promise<Page> {
  const page = await browser.newPage()
  if (phantom) {
    await page.addInitScript(mockPhantom(connected.publicKey.toBase58(), rejects))
  }
  const query = new URLSearchParams({
    action: 'kill',
    cluster: 'localnet',
    multisig: multisigPda.toBase58(),
    hot: c.hotWallet.publicKey.toBase58(),
  })
  await page.goto(`${server.origin}/?${query}`)
  return page
}

const heading = (page: Page) => page.locator('h1')

describe('the kill page', () => {
  it('shows what is signed, signs exactly removeSpendingLimit, and reads the kill back', async () => {
    const page = await open()
    await expect.poll(() => heading(page).textContent(), { timeout: 20_000 }).toBe('Killed')

    const [tx, ...more] = server.signed
    expect(more).toEqual([])
    const sent = TransactionMessage.decompile(tx!.message)
    expect(sent.payerKey.equals(owner.publicKey)).toBe(true)
    // Decompiling marks the owner a signer wherever it appears, since it pays the fee; the program,
    // the data and the accounts in order are what identify the instruction.
    const shape = (ix: TransactionInstruction) => ({
      programId: ix.programId.toBase58(),
      data: ix.data.toString('hex'),
      keys: ix.keys.map((key) => key.pubkey.toBase58()),
    })
    expect(sent.instructions.map(shape)).toEqual([
      shape(removeSpendingLimitInstruction(multisigPda, owner.publicKey, limit)),
    ])
    expect(c.svm.getAccount(limit)).toBeNull()
    expect(await page.locator('p').allTextContents()).toEqual([
      `The spending limit ${limit.toBase58()} is gone.`,
      'The hot wallet can no longer draw from the vault.',
    ])
  })

  it('names the hot wallet, the multisig, the limit and the program before Phantom asks', async () => {
    const page = await open({ rejects: true })
    await expect.poll(() => page.locator('button').textContent()).toBe('Ask Phantom again')
    const hot = c.hotWallet.publicKey.toBase58()
    expect(await page.locator('p').allTextContents()).toEqual([
      `Kill: remove the spending limit of hot wallet ${hot}.`,
      `Multisig ${multisigPda.toBase58()}, on localnet.`,
      `Spending limit ${limit.toBase58()}: 100000000 base units of ${c.mint.toBase58()} per ` +
        'period, 100000000 left.',
      'Afterwards the hot wallet cannot draw from the vault until a new limit is added.',
      `Program ${multisig.PROGRAM_ID.toBase58()}, instruction multisigRemoveSpendingLimit, signed ` +
        `by the config authority ${owner.publicKey.toBase58()}.`,
      'Phantom should show no token leaving your wallet, only the small SOL rent of the limit ' +
        'coming back to you. Reject anything else.',
      'Not signed: Error: User rejected the request.',
    ])
    expect(c.svm.getAccount(limit)).not.toBeNull()
  })

  it('says so when the limit is already gone, and offers nothing to sign', async () => {
    await (await open()).waitForSelector('text=Killed', { timeout: 20_000 })
    const again = await open()
    await expect.poll(() => heading(again).textContent()).toBe('Already killed')
    expect(server.signed).toHaveLength(1)
  })

  it('offers nothing to sign to a wallet that is not the config authority', async () => {
    connected = Keypair.generate()
    const page = await open()
    await expect.poll(() => heading(page).textContent()).toBe('Nothing to sign')
    await expect
      .poll(() => page.locator('p').textContent())
      .toContain("is not this multisig's config authority")
    expect(server.signed).toEqual([])
    expect(c.svm.getAccount(limit)).not.toBeNull()
  })

  it('sends a browser without Phantom to the Phantom universal link', async () => {
    const page = await open({ phantom: false })
    await expect.poll(() => heading(page).textContent()).toBe('Open this page in Phantom')
    const href = await page.locator('a').getAttribute('href')
    expect(href).toMatch(/^https:\/\/phantom\.app\/ul\/browse\/http%3A%2F%2F127\.0\.0\.1/)
  })

  it('refuses a link that does not name two Solana addresses', async () => {
    const page = await browser.newPage()
    await page.addInitScript(mockPhantom(owner.publicKey.toBase58()))
    await page.goto(`${server.origin}/?action=kill&cluster=localnet&multisig=nope&hot=nope`)
    await expect.poll(() => heading(page).textContent()).toBe('This link is not valid')
    expect(server.signed).toEqual([])
  })
})
