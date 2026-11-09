import {
  getAccount,
  getAssociatedTokenAddressSync,
  TokenAccountNotFoundError,
} from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { loadSvmConfig } from '../svm/config.js'
import { connect, findSpendingLimit, spendingLimitPda, VAULT_INDEX } from '../svm/squads.js'

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
  } catch (error) {
    if (!(error instanceof TokenAccountNotFoundError)) {
      throw error
    }
    console.log('  usdc:           none yet')
  }
}

const limit = spendingLimitPda(multisigPda, hotWallet)
// Only a missing account means no limit: an RPC error must not read as a confirmed kill.
const state = await findSpendingLimit(connection, limit)
if (state === null) {
  console.log(`spending limit:   none at ${limit.toBase58()}`)
} else {
  console.log(`spending limit:   ${limit.toBase58()}`)
  console.log(`  cap:            ${state.cap} atomic units per day`)
  console.log(`  spent:          ${state.spent}`)
  console.log(`  resets at:      ${state.resetsAt}`)
  console.log(`  members:        ${state.members.join(', ')}`)
  console.log(`  destinations:   ${state.destinations.join(', ') || '(any)'}`)
  const onlyHot = (keys: string[]) => keys.length === 1 && keys[0] === hotWallet.toBase58()
  if (!onlyHot(state.members) || !onlyHot(state.destinations)) {
    console.error(
      `UNEXPECTED: the limit's only member and destination must be ${hotWallet.toBase58()}`,
    )
    process.exitCode = 1
  }
}
