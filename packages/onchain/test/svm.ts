import {
  address,
  getTransactionDecoder,
  lamports,
  type EncodedAccount,
  type Transaction as KitTransaction,
} from '@solana/kit'
import {
  PublicKey,
  type AccountInfo,
  type Transaction,
  type VersionedTransaction,
} from '@solana/web3.js'
import {
  Clock,
  FailedTransactionMetadata,
  LiteSVM,
  type SimulatedTransactionInfo,
  type TransactionMetadata,
} from 'litesvm'

export { Clock, FailedTransactionMetadata }

/**
 * LiteSVM 1.x behind the web3.js types the adapter and the Squads SDK use. The 0.x releases, which
 * spoke web3.js directly, abort with std::bad_alloc after a few runs of any on-chain program but the
 * token program; 1.x does not, so the tests pay for a conversion at this boundary instead.
 */
export class Svm {
  private readonly inner = new LiteSVM()
  private readonly decoder = getTransactionDecoder()

  private kit(tx: Transaction | VersionedTransaction): KitTransaction {
    return this.decoder.decode(tx.serialize())
  }

  latestBlockhash(): string {
    return this.inner.latestBlockhash()
  }

  expireBlockhash(): void {
    this.inner.expireBlockhash()
  }

  airdrop(to: PublicKey, amount: bigint): void {
    this.inner.airdrop(address(to.toBase58()), lamports(amount))
  }

  getBalance(of: PublicKey): bigint | null {
    return this.inner.getBalance(address(of.toBase58()))
  }

  minimumBalanceForRentExemption(size: bigint): bigint {
    return this.inner.minimumBalanceForRentExemption(size)
  }

  getAccount(at: PublicKey): AccountInfo<Buffer> | null {
    const found = this.inner.getAccount(address(at.toBase58()))
    return found.exists ? web3Account(found) : null
  }

  setAccount(at: PublicKey, account: Omit<AccountInfo<Uint8Array>, 'rentEpoch'>): void {
    this.inner.setAccount({
      address: address(at.toBase58()),
      data: Uint8Array.from(account.data),
      executable: account.executable,
      lamports: lamports(BigInt(account.lamports)),
      programAddress: address(account.owner.toBase58()),
      space: BigInt(account.data.length),
    })
  }

  addProgramFromFile(programId: PublicKey, path: string): void {
    this.inner.addProgramFromFile(address(programId.toBase58()), path)
  }

  withSigverify(on: boolean): void {
    this.inner.withSigverify(on)
  }

  getClock(): Clock {
    return this.inner.getClock()
  }

  setClock(clock: Clock): void {
    this.inner.setClock(clock)
  }

  sendTransaction(
    tx: Transaction | VersionedTransaction,
  ): TransactionMetadata | FailedTransactionMetadata {
    return this.inner.sendTransaction(this.kit(tx))
  }

  simulateTransaction(
    tx: Transaction | VersionedTransaction,
  ): FailedTransactionMetadata | SimulatedTransactionInfo {
    return this.inner.simulateTransaction(this.kit(tx))
  }
}

export function web3Account(account: EncodedAccount): AccountInfo<Buffer> {
  return {
    data: Buffer.from(account.data),
    executable: account.executable,
    lamports: Number(account.lamports),
    owner: new PublicKey(account.programAddress),
  }
}
