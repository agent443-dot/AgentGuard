import { loadSvmConfig } from '../svm/config.js'
import { loadOwner } from '../svm/owner.js'
import { connect, createMultisig } from '../svm/squads.js'

const config = loadSvmConfig()

// Creating a second multisig costs rent and leaves two vaults with no way to tell which one the
// money is supposed to be in. Refuse rather than let a repeated command decide that silently.
if (config.SQUADS_MULTISIG) {
  console.error(`A multisig is already configured: ${config.SQUADS_MULTISIG}`)
  console.error('Clear SQUADS_MULTISIG in .env first if you really want a new one.')
  process.exit(1)
}

const owner = await loadOwner(config.SOLANA_OWNER_KEYPAIR)
const connection = connect(config.SOLANA_RPC_URL)

console.log(`cluster: ${config.SOLANA_CLUSTER}`)
console.log(`owner:   ${owner.publicKey.toBase58()}`)

const { multisigPda, vault, signature } = await createMultisig(connection, owner)

console.log()
console.log(`multisig: ${multisigPda.toBase58()}`)
console.log(`vault:    ${vault.toBase58()}`)
console.log(`tx:       ${signature}`)
console.log()
console.log('Add to packages/onchain/.env and packages/guard-core/.env:')
console.log(`SQUADS_MULTISIG=${multisigPda.toBase58()}`)
console.log()
console.log('The money lives in the vault, not in the owner wallet. Send the USDC there next.')
