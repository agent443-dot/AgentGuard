import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, type Account } from '@solana/spl-token'
import { Keypair, PublicKey, TransactionMessage } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'
import { inspectTransfer } from '../src/svm/inspect.js'
import {
  checkEffects,
  expectedTransfer,
  formatUnits,
  transferInstructions,
  type Payment,
} from '../src/svm/transfer.js'

const hot = Keypair.generate().publicKey
const recipient = Keypair.generate().publicKey
const mint = Keypair.generate().publicKey
const payment: Payment = {
  feePayer: hot,
  hotWallet: hot,
  recipient,
  mint,
  amount: 2_500_000n,
  decimals: 6,
}

describe('transferInstructions', () => {
  const programs = (create: boolean) =>
    transferInstructions(payment, create).map((ix) => ix.programId.toBase58())

  it('is a lone TransferChecked when the recipient account exists', () => {
    expect(programs(false)).toEqual([TOKEN_PROGRAM_ID.toBase58()])
  })

  it('creates the recipient account first when it does not', () => {
    expect(programs(true)).toEqual([
      ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
      TOKEN_PROGRAM_ID.toBase58(),
    ])
  })

  it.each([true, false])('builds what the inspection accepts (create: %s)', (create) => {
    const message = new TransactionMessage({
      payerKey: hot,
      recentBlockhash: Keypair.generate().publicKey.toBase58(),
      instructions: transferInstructions(payment, create),
    }).compileToV0Message()
    expect(inspectTransfer(message, expectedTransfer(payment))).toEqual([])
  })

  it('pays a recipient that is a PDA, such as a Squads vault', () => {
    const [vault] = PublicKey.findProgramAddressSync([Buffer.from('vault')], TOKEN_PROGRAM_ID)
    expect(PublicKey.isOnCurve(vault)).toBe(false)
    expect(() => expectedTransfer({ ...payment, recipient: vault })).not.toThrow()
  })
})

describe('checkEffects', () => {
  const { source, destination } = expectedTransfer(payment)
  const account = (address: PublicKey, owner: PublicKey, amount: bigint): Account => ({
    address,
    mint,
    owner,
    amount,
    delegate: null,
    delegatedAmount: 0n,
    isInitialized: true,
    isFrozen: false,
    isNative: false,
    rentExemptReserve: null,
    closeAuthority: null,
    tlvData: Buffer.alloc(0),
  })
  const before = { source: account(source, hot, 10_000_000n), destination: null }
  const after = {
    source: account(source, hot, 7_500_000n),
    destination: account(destination, recipient, 2_500_000n),
  }

  it('accepts exactly the amount leaving one account and arriving in the other', () => {
    expect(checkEffects(before, after, payment)).toEqual([])
  })

  it.each([
    ['the hot wallet losing more', { source: account(source, hot, 7_499_999n) }],
    ['the recipient getting less', { destination: account(destination, recipient, 2_499_999n) }],
    ['the hot wallet account changing hands', { source: account(source, recipient, 7_500_000n) }],
    [
      'the recipient account owned by someone else',
      { destination: account(destination, hot, 2_500_000n) },
    ],
    ['a delegate left behind', { source: { ...after.source, delegate: recipient } }],
    ['a close authority left behind', { source: { ...after.source, closeAuthority: recipient } }],
    ['a different mint', { destination: { ...after.destination, mint: hot } }],
    ['the hot wallet account closed', { source: null }],
    ['no recipient account', { destination: null }],
  ])('refuses %s', (_case, change) => {
    expect(checkEffects(before, { ...after, ...change }, payment)).toEqual([
      'SIM_UNEXPECTED_EFFECT',
    ])
  })

  it('refuses when the hot wallet had no account to pay from', () => {
    expect(checkEffects({ source: null, destination: null }, after, payment)).toEqual([
      'SIM_UNEXPECTED_EFFECT',
    ])
  })

  it('counts a recipient balance that was already there', () => {
    const held = { ...before, destination: account(destination, recipient, 1n) }
    const paid = { ...after, destination: account(destination, recipient, 2_500_001n) }
    expect(checkEffects(held, paid, payment)).toEqual([])
    expect(checkEffects(held, after, payment)).toEqual(['SIM_UNEXPECTED_EFFECT'])
  })
})

describe('formatUnits', () => {
  it.each([
    [0n, '0'],
    [1n, '0.000001'],
    [1_500_000n, '1.5'],
    [100_000_000n, '100'],
    [123_456_789n, '123.456789'],
    [2n ** 64n - 1n, '18446744073709.551615'],
  ])('%s', (amount, text) => {
    expect(formatUnits(amount, 6)).toBe(text)
  })
})
