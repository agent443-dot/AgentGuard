import { CHAINS } from '@agentguard/shared'
import {
  ACCOUNT_SIZE,
  AccountLayout,
  AccountState,
  createInitializeMint2Instruction,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { Svm } from './svm.js'
import { svmAdapter } from '../src/svm/adapter.js'
import { spendingLimitPda, VAULT_INDEX } from '../src/svm/squads.js'
import { liteConnection } from './litesvm.js'

export const USDC = 1_000_000n

/** A fresh chain with a USDC-like mint, a funded hot wallet and an adapter pointed at both. */
export function chain() {
  const svm = new Svm()
  const connection = liteConnection(svm)
  const payer = Keypair.generate()
  const hotWallet = Keypair.generate()
  const mintKey = Keypair.generate()
  const mint = mintKey.publicKey
  const multisigPda = multisig.getMultisigPda({ createKey: Keypair.generate().publicKey })[0]
  svm.airdrop(payer.publicKey, BigInt(10 * LAMPORTS_PER_SOL))
  svm.airdrop(hotWallet.publicKey, BigInt(LAMPORTS_PER_SOL))

  function run(instructions: TransactionInstruction[], ...signers: Keypair[]) {
    const tx = new Transaction().add(...instructions)
    tx.recentBlockhash = svm.latestBlockhash()
    tx.feePayer = payer.publicKey
    tx.sign(payer, ...signers)
    const result = svm.sendTransaction(tx)
    svm.expireBlockhash()
    return result
  }

  // Planted rather than minted: a balance is all most tests need, and it keeps the mint authority
  // out of every transaction they inspect.
  function fund(owner: PublicKey, amount: bigint): PublicKey {
    const address = getAssociatedTokenAddressSync(mint, owner, true)
    const data = Buffer.alloc(ACCOUNT_SIZE)
    AccountLayout.encode(
      {
        mint,
        owner,
        amount,
        delegateOption: 0,
        delegate: PublicKey.default,
        state: AccountState.Initialized,
        isNativeOption: 0,
        isNative: 0n,
        delegatedAmount: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
      },
      data,
    )
    svm.setAccount(address, {
      lamports: Number(svm.minimumBalanceForRentExemption(BigInt(ACCOUNT_SIZE))),
      data,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    })
    return address
  }

  function balance(owner: PublicKey): bigint {
    const account = svm.getAccount(getAssociatedTokenAddressSync(mint, owner, true))
    return account ? Buffer.from(account.data).readBigUInt64LE(64) : 0n
  }

  run(
    [
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint,
        lamports: Number(svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE))),
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(mint, 6, payer.publicKey, null),
    ],
    mintKey,
  )

  const adapter = svmAdapter({
    chain: CHAINS.solanaDevnet,
    connection,
    hotWallet,
    multisigPda,
    mint,
  })
  return { svm, connection, payer, hotWallet, mint, multisigPda, adapter, run, fund, balance }
}

export type Chain = ReturnType<typeof chain>

/**
 * Writes Squads accounts straight into the chain. Reading them back needs only their layout, not
 * the Squads program, which is what lets these tests run without its binary.
 */
export function plantMultisig(c: Chain, configAuthority: PublicKey) {
  const data = multisig.accounts.Multisig.fromArgs({
    createKey: Keypair.generate().publicKey,
    configAuthority,
    threshold: 1,
    timeLock: 0,
    transactionIndex: 0,
    staleTransactionIndex: 0,
    rentCollector: null,
    bump: 255,
    members: [],
  }).serialize()[0]
  plant(c, c.multisigPda, data)
}

export function plantSpendingLimit(c: Chain, cap: bigint, remaining: bigint, lastReset: number) {
  const data = multisig.accounts.SpendingLimit.fromArgs({
    multisig: c.multisigPda,
    createKey: c.hotWallet.publicKey,
    vaultIndex: VAULT_INDEX,
    mint: c.mint,
    amount: Number(cap),
    period: multisig.generated.Period.Day,
    remainingAmount: Number(remaining),
    lastReset,
    bump: 255,
    members: [c.hotWallet.publicKey],
    destinations: [c.hotWallet.publicKey],
  }).serialize()[0]
  plant(c, spendingLimitPda(c.multisigPda, c.hotWallet.publicKey), data)
}

function plant(c: Chain, address: PublicKey, data: Buffer) {
  c.svm.setAccount(address, {
    lamports: Number(c.svm.minimumBalanceForRentExemption(BigInt(data.length))),
    data,
    owner: multisig.PROGRAM_ID,
    executable: false,
  })
}

/** The Squads program's global config, which multisig creation reads for its fee and treasury. */
export function plantProgramConfig(
  target: Chain,
  { fee = 0, treasury = Keypair.generate().publicKey } = {},
) {
  const [address] = multisig.getProgramConfigPda({})
  const data = multisig.accounts.ProgramConfig.fromArgs({
    authority: Keypair.generate().publicKey,
    multisigCreationFee: fee,
    treasury,
    reserved: new Array<number>(64).fill(0),
  }).serialize()[0]
  target.svm.setAccount(address, {
    lamports: Number(target.svm.minimumBalanceForRentExemption(BigInt(data.length))),
    data,
    owner: multisig.PROGRAM_ID,
    executable: false,
  })
}
