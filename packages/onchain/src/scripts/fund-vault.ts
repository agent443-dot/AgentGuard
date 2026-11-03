import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
} from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { loadSvmConfig } from '../svm/config.js'
import { loadOwner } from '../svm/owner.js'
import { connect, sendAsOwner, VAULT_INDEX } from '../svm/squads.js'

const amountArg = process.argv[2]
if (!amountArg || !/^[1-9]\d*$/.test(amountArg)) {
  console.error('usage: pnpm fund-vault <amount in atomic units>   e.g. 10000000 = 10 USDC')
  process.exit(1)
}

const config = loadSvmConfig()
if (!config.SQUADS_MULTISIG || !config.USDC_MINT) {
  console.error('SQUADS_MULTISIG and USDC_MINT must both be set.')
  process.exit(1)
}

const owner = await loadOwner(config.SOLANA_OWNER_KEYPAIR)
const connection = connect(config.SOLANA_RPC_URL)
const mint = new PublicKey(config.USDC_MINT)
const [vault] = multisig.getVaultPda({
  multisigPda: new PublicKey(config.SQUADS_MULTISIG),
  index: VAULT_INDEX,
})

const { decimals } = await getMint(connection, mint)
const from = await getAccount(connection, getAssociatedTokenAddressSync(mint, owner.publicKey))

// The vault is a PDA, so its token account has an owner off the ed25519 curve. The default refuses
// that, which is likely why a faucet sending straight to the vault never arrives.
const to = getAssociatedTokenAddressSync(mint, vault, true)

const amount = BigInt(amountArg)
if (from.amount < amount) {
  console.error(`owner holds ${from.amount}, cannot send ${amount}`)
  process.exit(1)
}

// transferChecked rejects the transfer if the mint or the decimals are not what we think they are.
const signature = await sendAsOwner(connection, owner, [
  createAssociatedTokenAccountIdempotentInstruction(owner.publicKey, to, vault, mint),
  createTransferCheckedInstruction(from.address, mint, to, owner.publicKey, amount, decimals),
])

console.log(`vault:         ${vault.toBase58()}`)
console.log(`vault account: ${to.toBase58()}`)
console.log(`sent:          ${amount} atomic units`)
console.log(`tx:            ${signature}`)
