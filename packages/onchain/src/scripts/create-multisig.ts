import { loadKeypair, loadSvmConfig } from '../svm/config.js'
import { connect, createMultisig } from '../svm/squads.js'

const config = loadSvmConfig()
const owner = loadKeypair(config.SOLANA_OWNER_KEYPAIR)
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
