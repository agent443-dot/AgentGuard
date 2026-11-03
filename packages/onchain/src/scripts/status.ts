import { getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { loadSvmConfig } from '../svm/config.js'
import { connect, readSpendingLimit, spendingLimitPda, VAULT_INDEX } from '../svm/squads.js'

const config = loadSvmConfig()
if (!config.SQUADS_MULTISIG) {
  console.error('SQUADS_MULTISIG is not set. Run create-multisig first.')
  process.exit(1)
}

const connection = connect(config.SOLANA_RPC_URL)
const multisigPda = new PublicKey(config.SQUADS_MULTISIG)
const hotWallet = new PublicKey(config.SOLANA_HOT_WALLET_PUBKEY)
const [vault] = multisig.getVaultPda({ multisigPda, index: VAULT_INDEX })

const account = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda)
console.log(`multisig:         ${multisigPda.toBase58()}`)
console.log(`  threshold:      ${account.threshold}`)
console.log(`  members:        ${account.members.map((m) => m.key.toBase58()).join(', ')}`)
console.log(`  config auth:    ${account.configAuthority.toBase58()}`)

console.log(`vault:            ${vault.toBase58()}`)
if (config.USDC_MINT) {
  const ata = getAssociatedTokenAddressSync(new PublicKey(config.USDC_MINT), vault, true)
  try {
    const { amount } = await getAccount(connection, ata)
    console.log(`  usdc:           ${amount} atomic units`)
  } catch {
    console.log('  usdc:           none yet')
  }
}

const limit = spendingLimitPda(multisigPda, hotWallet)
try {
  const state = await readSpendingLimit(connection, limit)
  console.log(`spending limit:   ${limit.toBase58()}`)
  console.log(`  cap:            ${state.cap} atomic units per day`)
  console.log(`  spent:          ${state.spent}`)
  console.log(`  resets at:      ${state.resetsAt}`)
  console.log(`  members:        ${state.members.join(', ')}`)
  console.log(`  destinations:   ${state.destinations.join(', ') || '(any)'}`)
} catch {
  console.log(`spending limit:   none at ${limit.toBase58()}`)
}
