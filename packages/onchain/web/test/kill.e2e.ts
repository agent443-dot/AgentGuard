import { Keypair, TransactionMessage, type PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { chromium, type Browser } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { keypairOwner } from '../../src/svm/owner.js'
import {
  addDailySpendingLimit,
  createMultisig,
  removeSpendingLimitInstruction,
  spendingLimitPda,
} from '../../src/svm/squads.js'
import { USDC } from '../../test/fixture.js'
import { heading, lines, sentInstructions, shape, stage } from './harness.js'

/** The kill page in Chromium, against the real Squads program, with a stand-in for Phantom. */
let browser: Browser
let s: Awaited<ReturnType<typeof stage>>
let multisigPda: PublicKey
let limit: PublicKey

beforeAll(async () => {
  browser = await chromium.launch()
})
afterAll(() => browser.close())

beforeEach(async () => {
  s = await stage()
  const owner = keypairOwner(s.owner)
  multisigPda = (await createMultisig(s.c.connection, owner)).multisigPda
  await addDailySpendingLimit(s.c.connection, owner, {
    multisigPda,
    createKey: s.c.hotWallet.publicKey,
    mint: s.c.mint,
    amount: 100n * USDC,
    members: [s.c.hotWallet.publicKey],
    destinations: [s.c.hotWallet.publicKey],
  })
  limit = spendingLimitPda(multisigPda, s.c.hotWallet.publicKey)
})
afterEach(() => s.server.close())

const now = () => Math.floor(Date.now() / 1000)
const kill = (issued = now()) => ({
  action: 'kill',
  multisig: multisigPda.toBase58(),
  hot: s.c.hotWallet.publicKey.toBase58(),
  issued: String(issued),
})

describe('the kill page', () => {
  it('signs exactly removeSpendingLimit, and reads the kill back', async () => {
    const page = await s.open(browser, kill())
    await expect.poll(() => heading(page).textContent(), { timeout: 20_000 }).toBe('Killed')

    const [tx, ...more] = s.server.signed
    expect(more).toEqual([])
    expect(TransactionMessage.decompile(tx!.message).payerKey.equals(s.owner.publicKey)).toBe(true)
    expect(sentInstructions(tx!)).toEqual([
      shape(removeSpendingLimitInstruction(multisigPda, s.owner.publicKey, limit)),
    ])
    expect(s.c.svm.getAccount(limit)).toBeNull()
    expect(await lines(page)).toEqual([
      `The spending limit ${limit.toBase58()} is gone.`,
      'The hot wallet can no longer draw from the vault.',
      'In Telegram, check /status that guard-core is paused, or run /kill → Kill everything if ' +
        'you have not.',
    ])
  })

  it('names the hot wallet, the multisig, the limit and the program before Phantom asks', async () => {
    const page = await s.open(browser, kill(), { rejects: true })
    await expect.poll(() => page.locator('button').textContent()).toBe('Ask Phantom again')
    const hot = s.c.hotWallet.publicKey.toBase58()
    expect(await lines(page)).toEqual([
      `Kill: remove the spending limit of hot wallet ${hot}.`,
      `Multisig ${multisigPda.toBase58()}, on localnet.`,
      `Spending limit ${limit.toBase58()}: 100000000 base units of ${s.c.mint.toBase58()} per ` +
        'period, 100000000 left.',
      'Afterwards the hot wallet cannot draw from the vault until a new limit is added.',
      `Program ${multisig.PROGRAM_ID.toBase58()}, instruction multisigRemoveSpendingLimit, signed ` +
        `by the config authority ${s.owner.publicKey.toBase58()}.`,
      'Phantom should show no token leaving your wallet, only the small SOL rent of the limit ' +
        'coming back to you. Reject anything else.',
      'Not signed: Error: User rejected the request.',
    ])
    expect(s.c.svm.getAccount(limit)).not.toBeNull()
  })

  it('says so when the limit is already gone, and offers nothing to sign', async () => {
    await (await s.open(browser, kill())).waitForSelector('text=Killed', { timeout: 20_000 })
    const again = await s.open(browser, kill())
    await expect.poll(() => heading(again).textContent()).toBe('Already killed')
    expect(s.server.signed).toHaveLength(1)
  })

  it('offers nothing to sign to a wallet that is not the config authority', async () => {
    s.wallet.connected = Keypair.generate()
    const page = await s.open(browser, kill())
    await expect.poll(() => heading(page).textContent()).toBe('Nothing to sign')
    await expect
      .poll(() => page.locator('p').textContent())
      .toContain("is not this multisig's config authority")
    expect(s.server.signed).toEqual([])
    expect(s.c.svm.getAccount(limit)).not.toBeNull()
  })

  it('sends a browser without Phantom to the Phantom universal link', async () => {
    const page = await s.open(browser, kill(), { phantom: false })
    await expect.poll(() => heading(page).textContent()).toBe('Open this page in Phantom')
    const href = await page.locator('a').getAttribute('href')
    expect(href).toMatch(/^https:\/\/phantom\.app\/ul\/browse\/http%3A%2F%2F127\.0\.0\.1/)
  })

  it.each([['toString'], ['constructor'], ['testnet']])(
    'refuses the cluster %j',
    async (cluster) => {
      const page = await s.open(browser, { ...kill(), cluster })
      await expect.poll(() => heading(page).textContent()).toBe('This link is not valid')
      expect(await lines(page)).toEqual(['cluster: unknown cluster'])
    },
  )

  it('refuses a kill link older than 15 minutes, so a stale button cannot fire', async () => {
    const page = await s.open(browser, kill(now() - 15 * 60 - 1))
    await expect.poll(() => heading(page).textContent()).toBe('Nothing to sign')
    expect(await lines(page)).toEqual(['This link expired. Use /kill in Telegram for a fresh one.'])
    expect(s.server.signed).toEqual([])
    expect(s.c.svm.getAccount(limit)).not.toBeNull()
  })

  it('accepts one just inside the 15 minutes', async () => {
    const page = await s.open(browser, kill(now() - 14 * 60))
    await expect.poll(() => heading(page).textContent(), { timeout: 20_000 }).toBe('Killed')
  })

  it.each([
    ['without issued', { issued: undefined }],
    ['issued in the future', { issued: String(Math.floor(Date.now() / 1000) + 3600) }],
    ['with issued not a number', { issued: 'soon' }],
  ])('refuses a kill link %s', async (_case, change) => {
    const { issued, ...rest } = { ...kill(), ...change }
    const page = await s.open(browser, issued === undefined ? rest : { ...rest, issued })
    await expect.poll(() => heading(page).textContent()).toBe('This link is not valid')
    expect(s.server.signed).toEqual([])
  })

  it('refuses a kill naming another hot wallet, instead of finding no limit and saying killed', async () => {
    const other = Keypair.generate().publicKey.toBase58()
    const page = await s.open(browser, { ...kill(), hot: other })
    await expect.poll(() => heading(page).textContent()).toBe('Nothing to sign')
    expect(await lines(page)).toEqual([
      `The link names ${other} as the hot wallet, but this page only acts for ` +
        `${s.c.hotWallet.publicKey.toBase58()}. Do not sign anything from this link.`,
    ])
    expect(s.server.signed).toEqual([])
    expect(s.c.svm.getAccount(limit)).not.toBeNull()
  })

  it('kills the hot wallet the page was built for when the link names none', async () => {
    const { hot: _hot, ...rest } = kill()
    const page = await s.open(browser, rest)
    await expect.poll(() => heading(page).textContent(), { timeout: 20_000 }).toBe('Killed')
    expect(s.c.svm.getAccount(limit)).toBeNull()
  })

  it('refuses a link that does not name two Solana addresses', async () => {
    const page = await s.open(browser, { action: 'kill', multisig: 'nope', hot: 'nope' })
    await expect.poll(() => heading(page).textContent()).toBe('This link is not valid')
    expect(s.server.signed).toEqual([])
  })
})
