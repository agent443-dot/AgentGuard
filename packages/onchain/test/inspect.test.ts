import {
  AuthorityType,
  createApproveCheckedInstruction,
  createApproveInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSetAuthorityInstruction,
  createTransferCheckedInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  type PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
} from '@solana/web3.js'
import { describe, expect, it } from 'vitest'
import { inspectTransfer, type ExpectedTransfer } from '../src/svm/inspect.js'

const hot = Keypair.generate().publicKey
const recipient = Keypair.generate().publicKey
const attacker = Keypair.generate().publicKey
const mint = Keypair.generate().publicKey
const source = getAssociatedTokenAddressSync(mint, hot)
const destination = getAssociatedTokenAddressSync(mint, recipient)

const expected: ExpectedTransfer = {
  feePayer: hot,
  authority: hot,
  source,
  destination,
  mint,
  amount: 1_000_000n,
  decimals: 6,
}

const pay = (
  amount = 1_000_000n,
  to: PublicKey = destination,
  token: PublicKey = mint,
  decimals = 6,
) => createTransferCheckedInstruction(source, token, to, hot, amount, decimals)

function message(instructions: TransactionInstruction[], payer: PublicKey = hot) {
  return new TransactionMessage({
    payerKey: payer,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
    instructions,
  }).compileToLegacyMessage()
}

describe('inspectTransfer accepts', () => {
  it('a single checked USDC transfer of the exact amount to the exact recipient', () => {
    expect(inspectTransfer(message([pay()]), expected)).toEqual([])
  })

  it('creating the recipient token account the transfer pays into', () => {
    const create = createAssociatedTokenAccountIdempotentInstruction(
      hot,
      destination,
      recipient,
      mint,
    )
    expect(inspectTransfer(message([create, pay()]), expected)).toEqual([])
  })

  it('a compute budget inside the limits', () => {
    const budget = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
    ]
    expect(inspectTransfer(message([...budget, pay()]), expected)).toEqual([])
  })
})

describe('inspectTransfer refuses a payment that also grants standing authority', () => {
  it('an Approve bundled with the payment', () => {
    const approve = createApproveInstruction(source, attacker, hot, 10n ** 12n)
    expect(inspectTransfer(message([pay(), approve]), expected)).toContain('DELEGATE_DETECTED')
  })

  it('an ApproveChecked bundled with the payment', () => {
    const approve = createApproveCheckedInstruction(source, mint, attacker, hot, 1n, 6)
    expect(inspectTransfer(message([pay(), approve]), expected)).toContain('DELEGATE_DETECTED')
  })

  it('a SetAuthority handing the token account to someone else', () => {
    const takeover = createSetAuthorityInstruction(
      source,
      hot,
      AuthorityType.AccountOwner,
      attacker,
    )
    expect(inspectTransfer(message([pay(), takeover]), expected)).toContain(
      'AUTHORITY_CHANGE_DETECTED',
    )
  })

  it('a CloseAccount sweeping the rent to someone else', () => {
    const close = createCloseAccountInstruction(source, attacker, hot)
    expect(inspectTransfer(message([pay(), close]), expected)).toContain('ACCOUNT_CLOSE_DETECTED')
  })

  it('reports every attack it finds, not just the first', () => {
    const reasons = inspectTransfer(
      message([
        pay(),
        createApproveInstruction(source, attacker, hot, 1n),
        createSetAuthorityInstruction(source, hot, AuthorityType.AccountOwner, attacker),
        createCloseAccountInstruction(source, attacker, hot),
      ]),
      expected,
    )
    expect(reasons).toEqual(
      expect.arrayContaining([
        'DELEGATE_DETECTED',
        'AUTHORITY_CHANGE_DETECTED',
        'ACCOUNT_CLOSE_DETECTED',
      ]),
    )
  })
})

describe('inspectTransfer refuses what it cannot see or does not recognise', () => {
  it('an instruction to a program not on the allowlist', () => {
    const unknown = new TransactionInstruction({
      programId: attacker,
      keys: [],
      data: Buffer.from([0]),
    })
    expect(inspectTransfer(message([pay(), unknown]), expected)).toContain(
      'UNKNOWN_PROGRAM_DETECTED',
    )
  })

  it('a SOL transfer riding along with the payment', () => {
    const sol = SystemProgram.transfer({
      fromPubkey: hot,
      toPubkey: attacker,
      lamports: 1_000_000_000,
    })
    expect(inspectTransfer(message([pay(), sol]), expected)).toContain('UNKNOWN_PROGRAM_DETECTED')
  })

  it('accounts hidden behind an address lookup table', () => {
    const table = new AddressLookupTableAccount({
      key: Keypair.generate().publicKey,
      state: {
        deactivationSlot: 2n ** 64n - 1n,
        lastExtendedSlot: 0,
        lastExtendedSlotStartIndex: 0,
        addresses: [destination, mint],
      },
    })
    const v0 = new TransactionMessage({
      payerKey: hot,
      recentBlockhash: Keypair.generate().publicKey.toBase58(),
      instructions: [pay()],
    }).compileToV0Message([table])
    expect(v0.addressTableLookups.length).toBeGreaterThan(0)
    expect(inspectTransfer(v0, expected)).toEqual(['HIDDEN_ACCOUNTS_DETECTED'])
  })

  it('an unchecked Transfer, which carries no mint to bind it to USDC', () => {
    const unchecked = createTransferInstruction(source, destination, hot, 1_000_000n)
    expect(inspectTransfer(message([unchecked]), expected)).toContain('SIM_UNEXPECTED_EFFECT')
  })
})

describe('inspectTransfer refuses a payment that is not the one agreed', () => {
  it.each([
    ['a different amount', () => pay(1_000_001n)],
    ['a different recipient', () => pay(1_000_000n, getAssociatedTokenAddressSync(mint, attacker))],
    ['a different token', () => pay(1_000_000n, destination, Keypair.generate().publicKey)],
    ['different decimals', () => pay(1_000_000n, destination, mint, 9)],
  ])('%s', (_case, build) => {
    expect(inspectTransfer(message([build()]), expected)).toContain('SIM_UNEXPECTED_EFFECT')
  })

  it('the tokens moved by someone other than the hot wallet', () => {
    const foreign = createTransferCheckedInstruction(
      source,
      mint,
      destination,
      attacker,
      1_000_000n,
      6,
    )
    expect(inspectTransfer(message([foreign]), expected)).toContain('SIM_UNEXPECTED_EFFECT')
  })

  it('a second payment hidden behind the first', () => {
    expect(inspectTransfer(message([pay(), pay()]), expected)).toContain('SIM_UNEXPECTED_EFFECT')
  })

  it('no payment at all', () => {
    const budget = ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 })
    expect(inspectTransfer(message([budget]), expected)).toContain('SIM_UNEXPECTED_EFFECT')
  })

  it('a fee payer other than the one expected', () => {
    expect(inspectTransfer(message([pay()], attacker), expected)).toContain('SIM_UNEXPECTED_EFFECT')
  })

  it('creating a token account other than the destination', () => {
    const other = getAssociatedTokenAddressSync(mint, attacker)
    const create = createAssociatedTokenAccountIdempotentInstruction(hot, other, attacker, mint)
    expect(inspectTransfer(message([create, pay()]), expected)).toContain('SIM_UNEXPECTED_EFFECT')
  })
})

describe('inspectTransfer bounds the fee a transaction can burn', () => {
  it('a priority fee above the ceiling', () => {
    const greedy = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_001 })
    expect(inspectTransfer(message([greedy, pay()]), expected)).toContain('SIM_UNEXPECTED_EFFECT')
  })

  it('a compute unit limit above the ceiling', () => {
    const greedy = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_001 })
    expect(inspectTransfer(message([greedy, pay()]), expected)).toContain('SIM_UNEXPECTED_EFFECT')
  })
})
