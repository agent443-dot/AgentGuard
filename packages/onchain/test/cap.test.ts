import { fileURLToPath } from 'node:url'
import type { PayIntent } from '@agentguard/shared'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { Keypair, LAMPORTS_PER_SOL, SystemProgram, type PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { Clock } from './svm.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { svmAdapter, type SvmAdapter } from '../src/svm/adapter.js'
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
 * committed. A missing binary fails these tests rather than skipping them: they are the gate.
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
let limited: SvmAdapter
let vault: PublicKey

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

describe('the Squads spending limit', () => {
  beforeEach(async () => {
    c = chain()
    c.svm.addProgramFromFile(multisig.PROGRAM_ID, binary)
    plantProgramConfig(c)

    // The owner on a Ledger, as on mainnet: the kill below is signed by the device.
    const owner = await ledgerOwner(fakeLedger(), "44'/501'/0'", () => {})
    c.svm.airdrop(owner.publicKey, BigInt(10 * LAMPORTS_PER_SOL))
    const created = await createMultisig(c.connection, owner)
    const { multisigPda } = created
    vault = created.vault
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
    limited = svmAdapter({
      chain: c.adapter.chain,
      connection: c.connection,
      hotWallet: c.hotWallet,
      multisigPda,
      mint: c.mint,
    })
    draw = (amount) => limited.topUpHotWallet(amount.toString())
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

  describe('a payment from an empty hot wallet', () => {
    const recipient = Keypair.generate().publicKey
    const pay = (amount: bigint): PayIntent => ({
      id: '00000000-0000-4000-8000-000000000000',
      agentId: 'agent-1',
      kind: 'transfer',
      chain: c.adapter.chain,
      token: c.mint.toBase58(),
      amount: amount.toString(),
      recipient: recipient.toBase58(),
      reason: 'test',
      status: 'approved',
      rejectReasons: [],
      createdAt: '2026-11-03T00:00:00.000Z',
      expiresAt: '2026-11-03T00:10:00.000Z',
    })
    // A hot wallet that never held USDC has no token account at all.
    const neverHeld = () =>
      c.svm.setAccount(getAssociatedTokenAddressSync(c.mint, c.hotWallet.publicKey), {
        lamports: 0,
        data: new Uint8Array(),
        owner: SystemProgram.programId,
        executable: false,
      })

    it('clears, with the draw from the vault simulated in front of it and nothing moved', async () => {
      neverHeld()
      const outcome = await limited.simulate(pay(5n * USDC))
      expect(outcome.rejectReasons).toEqual([])
      expect(outcome.simulation.summary).toMatch(/^draws 5 USDC from the vault, then pays 5 USDC/)
      expect(c.balance(vault)).toBe(1_000n * USDC)
      expect(c.balance(c.hotWallet.publicKey)).toBe(0n)
    })

    it('is then paid for real: the top-up creates the token account, the payment goes out', async () => {
      neverHeld()
      await limited.topUpHotWallet((5n * USDC).toString())
      await limited.send(pay(5n * USDC))
      expect(c.balance(vault)).toBe(995n * USDC)
      expect(c.balance(recipient)).toBe(5n * USDC)
    })

    it('draws only the shortfall when the hot wallet holds part of it', async () => {
      await draw(2n * USDC)
      const outcome = await limited.simulate(pay(5n * USDC))
      expect(outcome.rejectReasons).toEqual([])
      expect(outcome.simulation.summary).toMatch(/^draws 3 USDC from the vault/)
    })

    it('fails, saying so, when the limit cannot cover the shortfall', async () => {
      await draw(98n * USDC)
      const outcome = await limited.simulate(pay(101n * USDC))
      expect(outcome.rejectReasons).toEqual(['SIM_FAILED'])
      expect(outcome.simulation.summary).toMatch(
        /^simulation failed: the top-up of 3 USDC from the vault exceeds the spending limit/,
      )
    })
  })
})
