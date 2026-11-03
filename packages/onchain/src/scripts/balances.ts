import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { z } from 'zod'
import { loadSvmConfig } from '../svm/config.js'
import { loadOwner } from '../svm/owner.js'
import { connect, VAULT_INDEX } from '../svm/squads.js'

const parsedTokenAccount = z.object({
  info: z.object({
    mint: z.string(),
    tokenAmount: z.object({ amount: z.string(), decimals: z.number(), uiAmountString: z.string() }),
  }),
})

const config = loadSvmConfig()
const connection = connect(config.SOLANA_RPC_URL)

const wallets: [string, PublicKey][] = [
  ['owner', (await loadOwner(config.SOLANA_OWNER_KEYPAIR, console.log)).publicKey],
  ['hot wallet', new PublicKey(config.SOLANA_HOT_WALLET_PUBKEY)],
]
if (config.SQUADS_MULTISIG) {
  const [vault] = multisig.getVaultPda({
    multisigPda: new PublicKey(config.SQUADS_MULTISIG),
    index: VAULT_INDEX,
  })
  wallets.push(['vault', vault])
}

for (const [label, address] of wallets) {
  const lamports = await connection.getBalance(address)
  console.log(`${label}: ${address.toBase58()}`)
  console.log(`  SOL: ${lamports / 1e9}`)

  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const { value } = await connection.getParsedTokenAccountsByOwner(address, { programId })
    for (const { account } of value) {
      const { info } = parsedTokenAccount.parse(account.data.parsed)
      // The mint is the token's identity. The token account address is just where this wallet
      // keeps it, and is the one people tend to copy by mistake.
      console.log(`  mint ${info.mint}: ${info.tokenAmount.uiAmountString}`)
    }
  }
}
