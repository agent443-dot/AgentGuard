import { PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { loadSvmConfig } from '../svm/config.js'
import { loadOwner } from '../svm/owner.js'
import { connect, readSpendingLimit, removeSpendingLimit, spendingLimitPda } from '../svm/squads.js'

const config = loadSvmConfig()
if (!config.SQUADS_MULTISIG) {
  console.error('SQUADS_MULTISIG is not set.')
  process.exit(1)
}

const connection = connect(config.SOLANA_RPC_URL)
const multisigPda = new PublicKey(config.SQUADS_MULTISIG)
const limit = spendingLimitPda(multisigPda, new PublicKey(config.SOLANA_HOT_WALLET_PUBKEY))

const state = await readSpendingLimit(connection, limit)
console.log(`spending limit ${limit.toBase58()}`)
console.log(`  cap ${state.cap}, spent ${state.spent}, members ${state.members.join(', ')}`)

// Removing the limit takes the hot wallet's access to the vault away entirely. It is undone only by
// running add-spending-limit again, so it asks first.
if (!process.argv.includes('--yes')) {
  console.log()
  console.log('This removes the hot wallet access to the vault. Re-run with --yes to do it.')
  process.exit(0)
}

const owner = await loadOwner(config.SOLANA_OWNER_KEYPAIR, console.log)
const { configAuthority } = await multisig.accounts.Multisig.fromAccountAddress(
  connection,
  multisigPda,
)
// Caught here rather than by the program: a Ledger on the wrong account would otherwise ask for a
// signature that can only fail.
if (!configAuthority.equals(owner.publicKey)) {
  console.error(`the owner key is ${owner.publicKey.toBase58()},`)
  console.error(`but only the config authority ${configAuthority.toBase58()} can remove the limit`)
  process.exit(1)
}

console.log(`signing as ${owner.publicKey.toBase58()}; confirm on the device if it is a Ledger`)
const signature = await removeSpendingLimit(connection, owner, multisigPda, limit)
console.log(`removed. tx: ${signature}`)
