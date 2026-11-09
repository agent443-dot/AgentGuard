import { Keypair, TransactionMessage } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { chromium, type Browser } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMultisigInstruction } from '../../src/svm/squads.js'
import { plantProgramConfig } from '../../test/fixture.js'
import { heading, lines, sentInstructions, shape, stage } from './harness.js'

/** The create page: a multisig the connected wallet controls, as create-multisig makes it. */
let browser: Browser
let s: Awaited<ReturnType<typeof stage>>

beforeAll(async () => {
  browser = await chromium.launch()
})
afterAll(() => browser.close())
beforeEach(async () => {
  s = await stage()
})
afterEach(() => s.server.close())

describe('the create page', () => {
  it('signs exactly multisigCreateV2 with the owner as config authority, and reads it back', async () => {
    const page = await s.open(browser, { action: 'create' })
    await expect
      .poll(() => heading(page).textContent(), { timeout: 20_000 })
      .toBe('Multisig created')

    const [tx, ...more] = s.server.signed
    expect(more).toEqual([])
    const message = TransactionMessage.decompile(tx!.message)
    // The one-time create key signs before Phantom, which keeps its signature.
    const createKey = message.instructions[0]!.keys.find(
      (key) => key.isSigner && !key.pubkey.equals(s.owner.publicKey),
    )!.pubkey
    const [configPda] = multisig.getProgramConfigPda({})
    const config = multisig.accounts.ProgramConfig.fromAccountInfo(
      s.c.svm.getAccount(configPda)!,
    )[0]
    expect(sentInstructions(tx!)).toEqual([
      shape(createMultisigInstruction(s.owner.publicKey, createKey, config.treasury)),
    ])

    const [multisigPda] = multisig.getMultisigPda({ createKey })
    const ms = multisig.accounts.Multisig.fromAccountInfo(s.c.svm.getAccount(multisigPda)!)[0]
    expect(ms.configAuthority.equals(s.owner.publicKey)).toBe(true)
    expect(ms.threshold).toBe(1)
    expect(ms.members.map((m) => m.key.toBase58())).toEqual([s.owner.publicKey.toBase58()])
    expect((await lines(page))[1]).toContain(`SQUADS_MULTISIG=${multisigPda.toBase58()}`)
  })

  it('shows the multisig, its authority, the fee and the program before Phantom asks', async () => {
    const page = await s.open(browser, { action: 'create' }, { rejects: true })
    await expect.poll(() => page.locator('button').textContent()).toBe('Ask Phantom again')
    const shown = await lines(page)
    expect(shown[1]).toBe(
      `Config authority and only member: this wallet, ${s.owner.publicKey.toBase58()}, with every ` +
        'permission. Threshold 1, no time lock.',
    )
    expect(shown[3]).toMatch(/^Squads' creation fee: 0 SOL, to its treasury /)
    expect(shown[4]).toMatch(
      new RegExp(`^Program ${multisig.PROGRAM_ID.toBase58()}, instruction multisigCreateV2, `),
    )
    expect(shown.at(-1)).toBe('Not signed: Error: User rejected the request.')
    expect(s.server.signed).toEqual([])
  })

  // Mainnet's config charges a creation fee to Squads' treasury; the planted default charges none.
  it('pays a creation fee to the treasury the program config names, as on mainnet', async () => {
    const treasury = Keypair.generate().publicKey
    plantProgramConfig(s.c, { fee: 100_000_000, treasury })
    const page = await s.open(browser, { action: 'create' })
    await expect
      .poll(() => heading(page).textContent(), { timeout: 20_000 })
      .toBe('Multisig created')
    expect(s.c.svm.getBalance(treasury)).toBe(100_000_000n)
  })

  it('makes the multisig for whichever wallet is connected, never for another', async () => {
    s.wallet.connected = Keypair.generate()
    s.c.svm.airdrop(s.wallet.connected.publicKey, 10n ** 9n)
    const page = await s.open(browser, { action: 'create' })
    await expect
      .poll(() => heading(page).textContent(), { timeout: 20_000 })
      .toBe('Multisig created')
    expect((await lines(page))[0]).toContain(
      `controlled by ${s.wallet.connected.publicKey.toBase58()} alone`,
    )
  })
})
