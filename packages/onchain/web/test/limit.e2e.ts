import { Keypair, PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { chromium, type Browser } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { keypairOwner } from '../../src/svm/owner.js'
import {
  addSpendingLimitInstruction,
  createMultisig,
  readSpendingLimit,
  spendingLimitPda,
} from '../../src/svm/squads.js'
import { heading, lines, sentInstructions, shape, stage } from './harness.js'

/** The add-limit page: the daily cap, exactly as add-spending-limit sets it. */
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
  multisigPda = (await createMultisig(s.c.connection, keypairOwner(s.owner))).multisigPda
  limit = spendingLimitPda(multisigPda, s.c.hotWallet.publicKey)
})
afterEach(() => s.server.close())

const addLimit = (amount = '100000000') => ({
  action: 'add-limit',
  multisig: multisigPda.toBase58(),
  hot: s.c.hotWallet.publicKey.toBase58(),
  amount,
})

describe('the add-limit page', () => {
  it('signs exactly multisigAddSpendingLimit for the hot wallet, and reads the cap back', async () => {
    const page = await s.open(browser, addLimit())
    await expect.poll(() => heading(page).textContent(), { timeout: 20_000 }).toBe('Daily cap set')

    const hot = s.c.hotWallet.publicKey
    expect(s.server.signed).toHaveLength(1)
    expect(sentInstructions(s.server.signed[0]!)).toEqual([
      shape(
        addSpendingLimitInstruction(s.owner.publicKey, {
          multisigPda,
          createKey: hot,
          mint: s.c.mint,
          amount: 100_000_000n,
          members: [hot],
          destinations: [hot],
        }),
      ),
    ])
    const state = await readSpendingLimit(s.c.connection, limit)
    expect(state).toMatchObject({
      cap: '100000000',
      spent: '0',
      members: [hot.toBase58()],
      destinations: [hot.toBase58()],
    })
    expect(await lines(page)).toEqual([
      `The hot wallet ${hot.toBase58()} may now draw up to 100 USDC a day from the vault.`,
    ])
  })

  it('leads with the cap in USDC, the mint, and who may draw, before Phantom asks', async () => {
    const page = await s.open(browser, addLimit('2500000'), { rejects: true })
    await expect.poll(() => page.locator('button').textContent()).toBe('Ask Phantom again')
    const hot = s.c.hotWallet.publicKey.toBase58()
    expect(await lines(page)).toEqual([
      `Daily cap: 2.5 USDC (2500000 base units of ${s.c.mint.toBase58()}), refilled every 24 hours.`,
      `Only the hot wallet ${hot} may draw on it, and only into itself.`,
      `Multisig ${multisigPda.toBase58()}, on localnet; limit account ${limit.toBase58()}.`,
      `Program ${multisig.PROGRAM_ID.toBase58()}, instruction multisigAddSpendingLimit, signed by ` +
        `the config authority ${s.owner.publicKey.toBase58()}.`,
      "Phantom should show only a little SOL leaving your wallet, the limit account's rent. " +
        'Reject anything else.',
      'Not signed: Error: User rejected the request.',
    ])
  })

  it('refuses a second limit: changing the cap means killing the first', async () => {
    await (
      await s.open(browser, addLimit())
    ).waitForSelector('text=Daily cap set', {
      timeout: 20_000,
    })
    const again = await s.open(browser, addLimit('1'))
    await expect.poll(() => heading(again).textContent()).toBe('Nothing to sign')
    expect(await lines(again)).toEqual([
      'The hot wallet already has a spending limit, 100000000 base units per period. To change ' +
        'it, kill it first, then add the new one.',
    ])
    expect(s.server.signed).toHaveLength(1)
  })

  it('offers nothing to a wallet that is not the config authority', async () => {
    s.wallet.connected = Keypair.generate()
    const page = await s.open(browser, addLimit())
    await expect.poll(() => heading(page).textContent()).toBe('Nothing to sign')
    expect(s.server.signed).toEqual([])
  })

  it.each([['0'], ['1.5'], ['-1'], ['18446744073709551616']])(
    'refuses the amount %j',
    async (amount) => {
      const page = await s.open(browser, addLimit(amount))
      await expect.poll(() => heading(page).textContent()).toBe('This link is not valid')
      expect(s.server.signed).toEqual([])
    },
  )

  it('refuses a link naming another hot wallet: only the one built in may draw', async () => {
    const attacker = Keypair.generate().publicKey.toBase58()
    const page = await s.open(browser, { ...addLimit(), hot: attacker })
    await expect.poll(() => heading(page).textContent()).toBe('Nothing to sign')
    expect(await lines(page)).toEqual([
      `The link names ${attacker} as the hot wallet, but this page only acts for ` +
        `${s.c.hotWallet.publicKey.toBase58()}. Do not sign anything from this link.`,
    ])
    expect(s.server.signed).toEqual([])
    expect(s.c.svm.getAccount(spendingLimitPda(multisigPda, new PublicKey(attacker)))).toBeNull()
  })

  it('sets the limit for the built-in hot wallet when the link names none', async () => {
    const { hot: _hot, ...link } = addLimit()
    const page = await s.open(browser, link)
    await expect.poll(() => heading(page).textContent(), { timeout: 20_000 }).toBe('Daily cap set')
    expect((await readSpendingLimit(s.c.connection, limit)).members).toEqual([
      s.c.hotWallet.publicKey.toBase58(),
    ])
  })

  it("refuses a cap above the build's maximum, and accepts one exactly at it", async () => {
    const above = await s.open(browser, addLimit('100000001'))
    await expect.poll(() => heading(above).textContent()).toBe('This link is not valid')
    expect(await lines(above)).toEqual([
      "amount: above this page's maximum daily cap of 100000000 base units",
    ])
    expect(s.server.signed).toEqual([])
    const at = await s.open(browser, addLimit('100000000'))
    await expect.poll(() => heading(at).textContent(), { timeout: 20_000 }).toBe('Daily cap set')
  })

  it('takes the mint from the build, never from the link', async () => {
    const page = await s.open(browser, {
      ...addLimit(),
      mint: Keypair.generate().publicKey.toBase58(),
    })
    await expect.poll(() => heading(page).textContent(), { timeout: 20_000 }).toBe('Daily cap set')
    expect((await readSpendingLimit(s.c.connection, limit)).cap).toBe('100000000')
    const sl = multisig.accounts.SpendingLimit.fromAccountInfo(s.c.svm.getAccount(limit)!)[0]
    expect(sl.mint.equals(s.c.mint)).toBe(true)
  })
})
