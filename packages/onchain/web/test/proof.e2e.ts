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

const HEADLINE = 'The most this agent can draw in the next 24 hours: '

/** Rewrites a Squads account in place, to give it what the Squads instructions would refuse. */
function rewrite<T>(
  address: PublicKey,
  type: {
    fromAccountInfo(info: never): [NoInfer<T>, number]
    fromArgs(args: T): { serialize(): [Buffer, number] }
  },
  change: (account: T) => T,
) {
  const info = s.c.svm.getAccount(address)!
  const data = type.fromArgs(change(type.fromAccountInfo(info as never)[0])).serialize()[0]
  s.c.svm.setAccount(address, { ...info, data })
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
  it('shows the most the agent can draw in a day, with no wallet and nothing signed', async () => {
    const page = await proof()
    expect(await heading(page).textContent()).toBe(`${HEADLINE}200 USDC`)
    const text = (await lines(page)).join('\n')
    expect(text).toContain(`lets only the hot wallet ${s.c.hotWallet.publicKey.toBase58()} draw`)
    expect(text).toMatch(/Left until \d{4}-\S+: 100 USDC\. Then the daily cap again: 100 USDC\./)
    expect(text).toContain(`Owner (config authority): ${s.owner.publicKey.toBase58()}`)
    expect(text).toContain(`Vault ${vault.toBase58()} holds 500 USDC.`)
    expect(await page.getAttribute('#app', 'data-state')).toBe('done')
    expect(s.server.signed).toEqual([])
  })

  it('counts what was drawn today, and says when it resets', async () => {
    await draw(30n * USDC)
    const page = await proof()
    expect(await heading(page).textContent()).toBe(`${HEADLINE}170 USDC`)
    expect((await lines(page)).join('\n')).toMatch(/Left until \d{4}-\S+: 70 USDC\./)
  })

  it('counts the full cap again once a day has passed, as Squads refills on the next draw', async () => {
    await removeSpendingLimit(s.c.connection, keypairOwner(s.owner), multisigPda, limit)
    clockAt(-2 * 86_400)
    await addLimit(s.c.hotWallet.publicKey, s.c.hotWallet.publicKey)
    await draw(30n * USDC)
    clockAt()
    const page = await proof()
    expect(await heading(page).textContent()).toBe(`${HEADLINE}200 USDC`)
    // The refill moves the reset forward by whole days, so the next one is less than a day away.
    const [, resetsAt] = /Left until (\S+): 100 USDC/.exec((await lines(page)).join('\n'))!
    expect(Date.parse(resetsAt!) - Date.now()).toBeLessThan(86_400_000)
    expect(Date.parse(resetsAt!)).toBeGreaterThan(Date.now() - 60_000)
  })

  it('is bounded by the vault when the vault holds less than is left', async () => {
    s.c.fund(vault, 20n * USDC)
    const page = await proof()
    expect(await heading(page).textContent()).toBe(`${HEADLINE}20 USDC`)
    expect(await lines(page)).toContain(
      'The vault holds less than that, so the vault is the limit.',
    )
  })

  it('says zero after a kill', async () => {
    await removeSpendingLimit(s.c.connection, keypairOwner(s.owner), multisigPda, limit)
    const page = await proof()
    expect(await heading(page).textContent()).toBe(`${HEADLINE}0 USDC`)
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

  it.each([
    [
      'a member besides the config authority',
      (ms: multisig.accounts.MultisigArgs) => ({
        ...ms,
        members: [...ms.members, { key: s.c.hotWallet.publicKey, permissions: { mask: 7 } }],
      }),
      'not only the config authority: members can move the vault through proposals.',
    ],
    [
      'the hot wallet as config authority',
      (ms: multisig.accounts.MultisigArgs) => ({ ...ms, configAuthority: s.c.hotWallet.publicKey }),
      'The hot wallet is the config authority: it can change the limits itself.',
    ],
  ])('refuses to verify a multisig with %s, even after a kill', async (_case, change, found) => {
    await removeSpendingLimit(s.c.connection, keypairOwner(s.owner), multisigPda, limit)
    rewrite(multisigPda, multisig.accounts.Multisig, change)
    const page = await proof()
    expect(await heading(page).textContent()).toBe('Not verified')
    expect((await lines(page)).join('\n')).toContain(found)
  })

  it.each([
    ['a weekly period', { period: multisig.generated.Period.Week }, 'it does not reset daily'],
    ['another vault', { vaultIndex: 1 }, 'it draws on vault 1'],
  ])('refuses to verify a limit with %s', async (_case, fields, found) => {
    rewrite(limit, multisig.accounts.SpendingLimit, (sl) => ({ ...sl, ...fields }))
    const page = await proof()
    expect(await heading(page).textContent()).toBe('Not verified')
    expect((await lines(page)).join('\n')).toContain(found)
  })

  it('says so when there is no multisig at the address', async () => {
    const page = await proof(Keypair.generate().publicKey)
    expect(await heading(page).textContent()).toBe('Not verified')
    expect((await lines(page))[0]).toMatch(/^There is no Squads multisig at /)
  })
})
