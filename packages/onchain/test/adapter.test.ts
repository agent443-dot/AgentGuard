import { CHAINS, type PayIntent } from '@agentguard/shared'
import {
  createApproveInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { TransactionInstruction } from '@solana/web3.js'
import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { beforeEach, describe, expect, it } from 'vitest'
import { MEMO_PROGRAM_ID } from '../src/svm/inspect.js'
import { chain, plantMultisig, plantSpendingLimit, USDC, type Chain } from './fixture.js'

let c: Chain
let recipient: PublicKey

beforeEach(() => {
  c = chain()
  recipient = Keypair.generate().publicKey
  c.fund(c.hotWallet.publicKey, 10n * USDC)
  c.fund(recipient, 0n)
})

const intent = (overrides: Partial<PayIntent> = {}): PayIntent => ({
  id: '00000000-0000-4000-8000-000000000000',
  agentId: 'agent-1',
  kind: 'transfer',
  chain: CHAINS.solanaDevnet,
  token: c.mint.toBase58(),
  amount: '1500000',
  recipient: recipient.toBase58(),
  reason: 'test',
  status: 'approved',
  rejectReasons: [],
  createdAt: '2026-11-03T00:00:00.000Z',
  expiresAt: '2026-11-03T00:10:00.000Z',
  ...overrides,
})

describe('getHotWalletBalance', () => {
  it('reads the hot wallet token account', async () => {
    expect(await c.adapter.getHotWalletBalance(c.mint.toBase58())).toBe('10000000')
  })

  it('is zero for a token the wallet never held', async () => {
    const other = Keypair.generate().publicKey.toBase58()
    expect(await c.adapter.getHotWalletBalance(other)).toBe('0')
  })
})

describe('simulate', () => {
  it('passes a transfer that moves exactly the amount, and describes it', async () => {
    const outcome = await c.adapter.simulate(intent())
    expect(outcome.rejectReasons).toEqual([])
    expect(outcome.simulation.summary).toContain('pays 1.5 USDC')
    expect(outcome.simulation.balanceChanges).toEqual([
      { token: c.mint.toBase58(), delta: '-1500000' },
    ])
  })

  it('moves nothing', async () => {
    await c.adapter.simulate(intent())
    expect(c.balance(c.hotWallet.publicKey)).toBe(10n * USDC)
    expect(c.balance(recipient)).toBe(0n)
  })

  it('refuses another chain', async () => {
    const outcome = await c.adapter.simulate(intent({ chain: CHAINS.solanaMainnet }))
    expect(outcome.rejectReasons).toEqual(['CHAIN_NOT_ALLOWED'])
  })

  it('refuses another token', async () => {
    const token = Keypair.generate().publicKey.toBase58()
    expect((await c.adapter.simulate(intent({ token }))).rejectReasons).toEqual([
      'TOKEN_NOT_ALLOWED',
    ])
  })

  it.each([['0'], ['-1'], ['1.5'], ['01'], ['']])('refuses the amount %j', async (amount) => {
    expect((await c.adapter.simulate(intent({ amount }))).rejectReasons).toEqual(['SIM_FAILED'])
  })

  it('refuses a recipient that is not an address', async () => {
    const outcome = await c.adapter.simulate(intent({ recipient: '0xdeadbeef' }))
    expect(outcome.rejectReasons).toEqual(['SIM_FAILED'])
  })

  it('fails a transfer the chain would refuse', async () => {
    const outcome = await c.adapter.simulate(intent({ amount: (11n * USDC).toString() }))
    expect(outcome.rejectReasons).toEqual(['SIM_FAILED'])
  })

  it('refuses when the hot wallet account carries a delegate', async () => {
    const source = getAssociatedTokenAddressSync(c.mint, c.hotWallet.publicKey)
    const attacker = Keypair.generate().publicKey
    c.run([createApproveInstruction(source, attacker, c.hotWallet.publicKey, 1n)], c.hotWallet)
    expect((await c.adapter.simulate(intent())).rejectReasons).toEqual(['SIM_UNEXPECTED_EFFECT'])
  })
})

describe('send', () => {
  it('pays the recipient', async () => {
    const signature = await c.adapter.send(intent())
    expect(signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/)
    expect(c.balance(c.hotWallet.publicKey)).toBe(10n * USDC - 1_500_000n)
    expect(c.balance(recipient)).toBe(1_500_000n)
  })

  it('creates the token account of a recipient who never held USDC', async () => {
    const newcomer = Keypair.generate().publicKey
    await c.adapter.send(intent({ recipient: newcomer.toBase58() }))
    expect(c.balance(newcomer)).toBe(1_500_000n)
  })

  it('refuses an intent for another chain without touching the chain', async () => {
    await expect(c.adapter.send(intent({ chain: CHAINS.base }))).rejects.toThrow(
      'send_refused: CHAIN_NOT_ALLOWED',
    )
    expect(c.balance(c.hotWallet.publicKey)).toBe(10n * USDC)
  })

  it('refuses an invalid amount', async () => {
    await expect(c.adapter.send(intent({ amount: '1e6' }))).rejects.toThrow('invalid_amount')
  })
})

describe('checkPayment, for an x402 transaction guard-core did not build', () => {
  const facilitator = Keypair.generate()

  function x402(extra: TransactionInstruction[] = [], amount = 1_500_000n) {
    c.svm.airdrop(facilitator.publicKey, BigInt(LAMPORTS_PER_SOL))
    const source = getAssociatedTokenAddressSync(c.mint, c.hotWallet.publicKey)
    const destination = getAssociatedTokenAddressSync(c.mint, recipient)
    const message = new TransactionMessage({
      payerKey: facilitator.publicKey,
      recentBlockhash: c.svm.latestBlockhash(),
      instructions: [
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
        createTransferCheckedInstruction(
          source,
          c.mint,
          destination,
          c.hotWallet.publicKey,
          amount,
          6,
        ),
        new TransactionInstruction({
          programId: MEMO_PROGRAM_ID,
          keys: [],
          data: Buffer.from('00112233445566778899aabbccddeeff'),
        }),
        ...extra,
      ],
    }).compileToV0Message()
    // The facilitator signs last, at settlement, so what guard-core sees is unsigned by it.
    const tx = new VersionedTransaction(message)
    tx.sign([c.hotWallet])
    return Buffer.from(tx.serialize()).toString('base64')
  }

  const check = (transaction: string, amount = '1500000') =>
    c.adapter.checkPayment({
      transaction,
      recipient: recipient.toBase58(),
      amount,
      feePayer: facilitator.publicKey.toBase58(),
    })

  it('passes the shape the x402 exact client builds', async () => {
    expect((await check(x402())).rejectReasons).toEqual([])
  })

  it('refuses a payment for more than agreed', async () => {
    expect((await check(x402([], 1_500_001n))).rejectReasons).toEqual(['SIM_UNEXPECTED_EFFECT'])
  })

  it('fails a transaction it cannot read', async () => {
    expect((await check('bm90IGEgdHJhbnNhY3Rpb24=')).rejectReasons).toEqual(['SIM_FAILED'])
  })

  it('refuses an Approve riding along', async () => {
    const source = getAssociatedTokenAddressSync(c.mint, c.hotWallet.publicKey)
    const approve = createApproveInstruction(
      source,
      facilitator.publicKey,
      c.hotWallet.publicKey,
      1n,
    )
    expect((await check(x402([approve]))).rejectReasons).toContain('DELEGATE_DETECTED')
  })
})

describe('getAllowanceState', () => {
  it('reads cap, spent and the next reset from the spending limit', async () => {
    plantSpendingLimit(c, 100n * USDC, 70n * USDC, 1_793_664_000)
    expect(await c.adapter.getAllowanceState()).toEqual({
      cap: '100000000',
      spent: '30000000',
      resetsAt: '2026-11-04T00:00:00.000Z',
      delegate: c.hotWallet.publicKey.toBase58(),
    })
  })
})

describe('buildKillTx', () => {
  it('returns the unsigned removal of the spending limit for the config authority', async () => {
    const owner = Keypair.generate().publicKey
    plantMultisig(c, owner)
    const kill = await c.adapter.buildKillTx()
    expect(kill.description).toContain(owner.toBase58())
    expect(kill.payload).toMatchObject({
      signer: owner.toBase58(),
      programId: multisig.PROGRAM_ID.toBase58(),
    })
    expect(kill.payload).toHaveProperty(
      'accounts',
      expect.arrayContaining([{ pubkey: owner.toBase58(), isSigner: true, isWritable: false }]),
    )
  })

  it('refuses a multisig with no config authority', async () => {
    plantMultisig(c, PublicKey.default)
    await expect(c.adapter.buildKillTx()).rejects.toThrow('multisig_not_controlled')
  })
})
