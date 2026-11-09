import { Keypair, type PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useSpendingLimit } from '../../src/svm/draw.js'
import { keypairOwner } from '../../src/svm/owner.js'
import {
  addDailySpendingLimit,
  createMultisig,
  removeSpendingLimit,
  spendingLimitPda,
} from '../../src/svm/squads.js'
import { USDC } from '../../test/fixture.js'
import { Clock } from '../../test/svm.js'
import { heading, lines, stage } from './harness.js'

/** The proof page on Solana: read-only, no wallet, against the real Squads program. */
let browser: Browser
let s: Awaited<ReturnType<typeof stage>>
let multisigPda: PublicKey
let vault: PublicKey
let limit: PublicKey

beforeAll(async () => {
  browser = await chromium.launch()
})
afterAll(() => browser.close())
afterEach(() => s.server.close())

/** The chain's clock, `seconds` from now: the page judges the daily reset by the browser's clock. */
function clockAt(seconds = 0) {
  const now = s.c.svm.getClock()
  s.c.svm.setClock(
    new Clock(
      now.slot + 1n,
      now.epochStartTimestamp,
      now.epoch,
      now.leaderScheduleEpoch,
      BigInt(Math.floor(Date.now() / 1000) + seconds),
    ),
  )
}

async function addLimit(createKey: PublicKey, member: PublicKey, amount = 100n * USDC) {
  await addDailySpendingLimit(s.c.connection, keypairOwner(s.owner), {
    multisigPda,
    createKey,
    mint: s.c.mint,
    amount,
    members: [member],
    destinations: [member],
  })
  const address = spendingLimitPda(multisigPda, createKey)
  if (!s.scanned.some((known) => known.equals(address))) s.scanned.push(address)
  return address
}

beforeEach(async () => {
  s = await stage()
  clockAt()
  multisigPda = (await createMultisig(s.c.connection, keypairOwner(s.owner))).multisigPda
  ;[vault] = multisig.getVaultPda({ multisigPda, index: 0 })
  s.c.fund(vault, 500n * USDC)
  limit = await addLimit(s.c.hotWallet.publicKey, s.c.hotWallet.publicKey)
})

/** No Phantom at all: the proof must need no wallet. */
async function proof(target = multisigPda): Promise<Page> {
  const page = await s.open(
    browser,
    { action: 'proof', multisig: target.toBase58() },
    { phantom: false },
  )
  await expect
    .poll(() => heading(page).textContent(), { timeout: 20_000 })
    .not.toMatch(/Reading the chain|^$/)
  return page
}

const draw = (amount: bigint) =>
  useSpendingLimit(s.c.connection, s.c.hotWallet, {
    multisigPda,
    spendingLimit: limit,
    mint: s.c.mint,
    amount,
    decimals: 6,
  })

describe('the proof page on Solana', () => {
  it('shows the most the agent can draw today, with no wallet and nothing signed', async () => {
    const page = await proof()
    expect(await heading(page).textContent()).toBe('The most this agent can draw today: 100 USDC')
    const text = (await lines(page)).join('\n')
    expect(text).toContain(`lets only the hot wallet ${s.c.hotWallet.publicKey.toBase58()} draw`)
    expect(text).toContain('Daily cap: 100 USDC. Left today: 100 USDC.')
    expect(text).toContain(`Owner (config authority): ${s.owner.publicKey.toBase58()}`)
    expect(text).toContain(`Vault ${vault.toBase58()} holds 500 USDC.`)
    expect(await page.getAttribute('#app', 'data-state')).toBe('done')
    expect(s.server.signed).toEqual([])
  })

  it('counts what was drawn today, and says when it resets', async () => {
    await draw(30n * USDC)
    const page = await proof()
    expect(await heading(page).textContent()).toBe('The most this agent can draw today: 70 USDC')
    expect((await lines(page)).join('\n')).toMatch(/Left today: 70 USDC\. It resets at \d{4}-/)
  })

  it('gives back the full cap once a day has passed, as Squads does on the next draw', async () => {
    await removeSpendingLimit(s.c.connection, keypairOwner(s.owner), multisigPda, limit)
    clockAt(-2 * 86_400)
    await addLimit(s.c.hotWallet.publicKey, s.c.hotWallet.publicKey)
    await draw(30n * USDC)
    clockAt()
    const page = await proof()
    expect(await heading(page).textContent()).toBe('The most this agent can draw today: 100 USDC')
    expect((await lines(page)).join('\n')).toContain('the full cap, because a day has passed')
  })

  it('is bounded by the vault when the vault holds less than is left', async () => {
    s.c.fund(vault, 20n * USDC)
    const page = await proof()
    expect(await heading(page).textContent()).toBe('The most this agent can draw today: 20 USDC')
    expect(await lines(page)).toContain(
      'The vault holds less than is left today, so the vault is the limit.',
    )
  })

  it('says zero after a kill', async () => {
    await removeSpendingLimit(s.c.connection, keypairOwner(s.owner), multisigPda, limit)
    const page = await proof()
    expect(await heading(page).textContent()).toBe('The most this agent can draw today: 0 USDC')
    expect((await lines(page))[0]).toMatch(/^No spending limit: the hot wallet cannot draw/)
  })

  it('refuses to verify a vault with a limit for another key', async () => {
    const other = Keypair.generate().publicKey
    const extra = await addLimit(other, other)
    const page = await proof()
    expect(await heading(page).textContent()).toBe('Not verified')
    expect(await lines(page)).toContain(
      `Spending limit ${extra.toBase58()}: it is not the hot wallet limit the agent uses; ` +
        `its members are ${other.toBase58()}; its destinations are ${other.toBase58()}.`,
    )
    expect(await page.getAttribute('#app', 'data-state')).toBe('stop')
  })

  it('refuses to verify a second limit for the hot wallet, which would let it draw more', async () => {
    const extra = await addLimit(Keypair.generate().publicKey, s.c.hotWallet.publicKey)
    const page = await proof()
    expect(await heading(page).textContent()).toBe('Not verified')
    expect(await lines(page)).toContain(
      `Spending limit ${extra.toBase58()}: it is not the hot wallet limit the agent uses.`,
    )
  })

  it('says it could not verify when the RPC refuses to list the spending limits', async () => {
    s.server.refused.add('getProgramAccounts')
    const page = await proof()
    expect(await heading(page).textContent()).toBe('Not verified')
    expect((await lines(page))[0]).toMatch(/^This could not be verified: the RPC did not answer/)
    expect((await lines(page)).join('\n')).toContain('getProgramAccounts is disabled on this RPC')
  })

  it('says so when there is no multisig at the address', async () => {
    const page = await proof(Keypair.generate().publicKey)
    expect(await heading(page).textContent()).toBe('Not verified')
    expect((await lines(page))[0]).toMatch(/^There is no Squads multisig at /)
  })
})
