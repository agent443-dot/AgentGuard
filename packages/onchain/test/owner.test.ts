import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { beforeEach, describe, expect, it } from 'vitest'
import { ledgerOwner, ledgerPath, type OwnerSigner } from '../src/svm/owner.js'
import { removeSpendingLimit, sendAsOwner, spendingLimitPda } from '../src/svm/squads.js'
import { chain, type Chain } from './fixture.js'
import { fakeLedger, type FakeLedger } from './ledger.js'

describe('ledgerPath', () => {
  it.each([
    ['usb://ledger', "44'/501'"],
    ['usb://ledger?key=0', "44'/501'/0'"],
    ['usb://ledger?key=2/1', "44'/501'/2'/1'"],
    ['usb://ledger/BsNsvfXqQTtJnagwFWdBS7FBXgnsK8VZ5CmuznN85swK?key=0', "44'/501'/0'"],
  ])('%s is %s', (uri, path) => {
    expect(ledgerPath(uri)).toBe(path)
  })

  it.each([['/home/owner/.config/solana/id.json'], ['usb://trezor'], ['usb://ledger?key=x']])(
    '%s is not a Ledger',
    (source) => {
      expect(ledgerPath(source)).toBeUndefined()
    },
  )
})

describe('an owner on a Ledger', () => {
  let c: Chain
  let device: FakeLedger
  let owner: OwnerSigner
  let told: string[]

  beforeEach(async () => {
    c = chain()
    const transport = fakeLedger()
    device = transport
    told = []
    owner = await ledgerOwner(transport, "44'/501'/0'", (line) => told.push(line))
    c.svm.airdrop(owner.publicKey, BigInt(LAMPORTS_PER_SOL))
  })

  it('takes its address from the device, one per derivation path', async () => {
    const other = await ledgerOwner(fakeLedger(), "44'/501'/1'", () => {})
    expect(other.publicKey.equals(owner.publicKey)).toBe(false)
    const same = await ledgerOwner(fakeLedger(), "44'/501'/0'", () => {})
    expect(same.publicKey.equals(owner.publicKey)).toBe(true)
  })

  // LiteSVM verifies signatures, so a transaction that lands proves the device signature is real.
  it('signs a transaction the chain accepts', async () => {
    const to = Keypair.generate().publicKey
    const pay = SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: to, lamports: 1e7 })
    await sendAsOwner(c.connection, owner, [pay])
    expect(c.svm.getBalance(to)).toBe(10_000_000n)
  })

  it('signs the kill as fee payer and config authority, its only signature', async () => {
    const limit = spendingLimitPda(c.multisigPda, c.hotWallet.publicKey)
    // No Squads program in this chain, so the transaction fails after the device signs it.
    await expect(removeSpendingLimit(c.connection, owner, c.multisigPda, limit)).rejects.toThrow()

    const [message] = device.signed
    expect(message?.header.numRequiredSignatures).toBe(1)
    expect(message?.staticAccountKeys[0]?.equals(owner.publicKey)).toBe(true)
    const [kill] = message?.compiledInstructions ?? []
    const program = message?.staticAccountKeys[kill?.programIdIndex ?? -1]
    expect(program?.equals(multisig.PROGRAM_ID)).toBe(true)
  })

  // The owner's only defence against a swapped transaction while blind signing is on.
  it('prints the Message Hash the device shows for the kill, before the device is asked', async () => {
    const limit = spendingLimitPda(c.multisigPda, c.hotWallet.publicKey)
    await expect(removeSpendingLimit(c.connection, owner, c.multisigPda, limit)).rejects.toThrow()
    const [shown] = device.shown
    expect(shown).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/)
    expect(told[0]).toBe(`If the Ledger shows a Message Hash, it must read exactly: ${shown}`)
  })

  it('advises turning blind signing off once it has signed', async () => {
    const to = Keypair.generate().publicKey
    const pay = SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: to, lamports: 1e7 })
    await sendAsOwner(c.connection, owner, [pay])
    expect(told.at(-1)).toMatch(/Turn Blind signing off again/)
  })

  it('says to enable blind signing when the app refuses the Squads instruction', async () => {
    device.blindSigning = false
    const limit = spendingLimitPda(c.multisigPda, c.hotWallet.publicKey)
    await expect(removeSpendingLimit(c.connection, owner, c.multisigPda, limit)).rejects.toThrow(
      /blind signing/,
    )
    expect(device.signed).toEqual([])
  })

  it('still signs a plain transfer with blind signing off', async () => {
    device.blindSigning = false
    const to = Keypair.generate().publicKey
    const pay = SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: to, lamports: 1e7 })
    await sendAsOwner(c.connection, owner, [pay])
    expect(c.svm.getBalance(to)).toBe(10_000_000n)
  })
})
