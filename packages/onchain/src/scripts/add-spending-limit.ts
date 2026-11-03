import { PublicKey } from '@solana/web3.js'
import { loadSvmConfig } from '../svm/config.js'
import { loadOwner } from '../svm/owner.js'
import {
  addDailySpendingLimit,
  connect,
  readSpendingLimit,
  spendingLimitPda,
} from '../svm/squads.js'

const config = loadSvmConfig()

if (!config.SQUADS_MULTISIG) {
  console.error('SQUADS_MULTISIG is not set. Run create-multisig first.')
  process.exit(1)
}
if (!config.USDC_MINT) {
  console.error('USDC_MINT is not set. Take it from the official Circle source, do not guess.')
  process.exit(1)
}

const owner = await loadOwner(config.SOLANA_OWNER_KEYPAIR, console.log)
const connection = connect(config.SOLANA_RPC_URL)
const multisigPda = new PublicKey(config.SQUADS_MULTISIG)
const hotWallet = new PublicKey(config.SOLANA_HOT_WALLET_PUBKEY)

// The hot wallet doubles as the seed for the limit's address, so one delegate means one limit and
// the address is always derivable from the pair without storing anything.
const limit = spendingLimitPda(multisigPda, hotWallet)

console.log(`multisig: ${multisigPda.toBase58()}`)
console.log(`member:   ${hotWallet.toBase58()}`)
console.log(`mint:     ${config.USDC_MINT}`)
console.log(`cap:      ${config.DAILY_CAP} atomic units per day`)

const signature = await addDailySpendingLimit(connection, owner, {
  multisigPda,
  createKey: hotWallet,
  mint: new PublicKey(config.USDC_MINT),
  amount: BigInt(config.DAILY_CAP),
  members: [hotWallet],
  // The only place this limit may send money. Refilling the hot wallet is its entire purpose, so a
  // compromised guard cannot redirect the draw somewhere else, only spend what the hot wallet holds.
  destinations: [hotWallet],
})

console.log()
console.log(`limit: ${limit.toBase58()}`)
console.log(`tx:    ${signature}`)
console.log()
console.log(JSON.stringify(await readSpendingLimit(connection, limit), null, 2))
