import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { Clock } from 'litesvm'
import { beforeEach, describe, expect, it } from 'vitest'
import { svmAdapter } from '../src/svm/adapter.js'
import { ledgerOwner } from '../src/svm/owner.js'
import {
  addDailySpendingLimit,
  createMultisig,
  removeSpendingLimit,
  spendingLimitPda,
} from '../src/svm/squads.js'
import { chain, USDC, type Chain } from './fixture.js'
import { fakeLedger } from './ledger.js'

/**
 * The onchain cap, with the real Squads v4 program giving every verdict. Its binary is dumped from
 * mainnet by the owner (`solana program dump SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf ...`) and
 * committed; until it is, these are skipped rather than faked.
 */
const binary = fileURLToPath(new URL('./fixtures/squads_v4.so', import.meta.url))
const CAP = 100n * USDC
const DAY = 24n * 60n * 60n

// Anchor's names for the two refusals, as they appear in the program logs. Asserting on them is what
// tells a capped draw apart from an empty vault or a malformed transaction.
const EXCEEDED = /SpendingLimitExceeded/
const GONE = /AccountNotInitialized/

let c: Chain
let draw: (amount: bigint) => Promise<string>
let removeLimit: () => Promise<string>

function warp(seconds: bigint) {
  const now = c.svm.getClock()
  c.svm.setClock(
    new Clock(
      now.slot + 1n,
      now.epochStartTimestamp,
      now.epoch,
      now.leaderScheduleEpoch,
      now.unixTimestamp + seconds,
    ),
  )
}

function plantProgramConfig(target: Chain) {
  const [address] = multisig.getProgramConfigPda({})
  const data = multisig.accounts.ProgramConfig.fromArgs({
    authority: Keypair.generate().publicKey,
    multisigCreationFee: 0,
    treasury: Keypair.generate().publicKey,
    reserved: new Array<number>(64).fill(0),
  }).serialize()[0]
  target.svm.setAccount(address, {
    lamports: Number(target.svm.minimumBalanceForRentExemption(BigInt(data.length))),
    data,
    owner: multisig.PROGRAM_ID,
    executable: false,
  })
}

describe.skipIf(!existsSync(binary))('the Squads spending limit', () => {
  beforeEach(async () => {
    c = chain()
    c.svm.addProgramFromFile(multisig.PROGRAM_ID, binary)
    plantProgramConfig(c)

    // The owner on a Ledger, as on mainnet: the kill below is signed by the device.
    const owner = await ledgerOwner(fakeLedger(), "44'/501'/0'")
    c.svm.airdrop(owner.publicKey, BigInt(10 * LAMPORTS_PER_SOL))
    const { multisigPda, vault } = await createMultisig(c.connection, owner)
    c.fund(vault, 1_000n * USDC)
    c.fund(c.hotWallet.publicKey, 0n)
    await addDailySpendingLimit(c.connection, owner, {
      multisigPda,
      createKey: c.hotWallet.publicKey,
      mint: c.mint,
      amount: CAP,
      members: [c.hotWallet.publicKey],
      destinations: [c.hotWallet.publicKey],
    })

    // The fixture's adapter points at a placeholder multisig; this one draws on the real limit.
    const adapter = svmAdapter({
      chain: c.adapter.chain,
      connection: c.connection,
      hotWallet: c.hotWallet,
      multisigPda,
      mint: c.mint,
    })
    draw = (amount) => adapter.topUpHotWallet(amount.toString())
    removeLimit = () =>
      removeSpendingLimit(
        c.connection,
        owner,
        multisigPda,
        spendingLimitPda(multisigPda, c.hotWallet.publicKey),
      )
  })

  it('lets the hot wallet draw up to the cap', async () => {
    await draw(60n * USDC)
    await draw(40n * USDC)
    expect(c.balance(c.hotWallet.publicKey)).toBe(CAP)
  })

  it('refuses a draw one unit past the cap', async () => {
    await draw(60n * USDC)
    await expect(draw(40n * USDC + 1n)).rejects.toThrow(EXCEEDED)
    expect(c.balance(c.hotWallet.publicKey)).toBe(60n * USDC)
  })

  it('refills once the day has passed', async () => {
    await draw(CAP)
    await expect(draw(1n)).rejects.toThrow(EXCEEDED)
    warp(DAY + 1n)
    await draw(CAP)
    expect(c.balance(c.hotWallet.publicKey)).toBe(2n * CAP)
  })

  it('refuses everything after the kill', async () => {
    await removeLimit()
    await expect(draw(1n)).rejects.toThrow(GONE)
    expect(c.balance(c.hotWallet.publicKey)).toBe(0n)
  })
})
