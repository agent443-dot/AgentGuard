import { getMint } from '@solana/spl-token'
import { PublicKey, SendTransactionError } from '@solana/web3.js'
import { loadKeypair, loadSvmConfig } from '../svm/config.js'
import { connect, readSpendingLimit, spendingLimitPda, useSpendingLimit } from '../svm/squads.js'

/**
 * A test harness for the onchain cap. In production guard-core makes this draw through the
 * ChainAdapter; the hot wallet key never goes in this package's .env, so it is passed explicitly:
 *
 *   SOLANA_HOT_WALLET_KEYPAIR=~/.agentguard/sol-hot.json pnpm top-up 1000000
 */
const amountArg = process.argv[2]
const keypairPath = process.env['SOLANA_HOT_WALLET_KEYPAIR']
if (!amountArg || !/^[1-9]\d*$/.test(amountArg) || !keypairPath) {
  console.error('usage: SOLANA_HOT_WALLET_KEYPAIR=<path> pnpm top-up <amount in atomic units>')
  process.exit(1)
}

const config = loadSvmConfig()
if (!config.SQUADS_MULTISIG || !config.USDC_MINT) {
  console.error('SQUADS_MULTISIG and USDC_MINT must both be set.')
  process.exit(1)
}

const hotWallet = loadKeypair(keypairPath)
if (hotWallet.publicKey.toBase58() !== config.SOLANA_HOT_WALLET_PUBKEY) {
  console.error('that keypair is not the configured hot wallet')
  process.exit(1)
}

const connection = connect(config.SOLANA_RPC_URL)
const multisigPda = new PublicKey(config.SQUADS_MULTISIG)
const mint = new PublicKey(config.USDC_MINT)
const limit = spendingLimitPda(multisigPda, hotWallet.publicKey)
const { decimals } = await getMint(connection, mint)

// Reading the limit is only for the printout. If it is missing we still attempt the draw: the point
// of this harness is to let the chain give the verdict, not to refuse on its behalf.
try {
  const before = await readSpendingLimit(connection, limit)
  console.log(`cap ${before.cap}, spent ${before.spent}, asking for ${amountArg}`)
} catch {
  console.log(`no spending limit found at ${limit.toBase58()}, attempting the draw anyway`)
}

let signature: string
try {
  signature = await useSpendingLimit(connection, hotWallet, {
    multisigPda,
    spendingLimit: limit,
    mint,
    amount: BigInt(amountArg),
    decimals,
  })
} catch (error) {
  console.error(`REFUSED: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
  // The program logs name the rule that refused the draw, which is what tells a capped limit apart
  // from an empty vault or a missing account.
  const logs = error instanceof SendTransactionError ? error.logs : undefined
  for (const line of logs ?? []) {
    console.error(`  ${line}`)
  }
  process.exit(1)
}

const after = await readSpendingLimit(connection, limit)
console.log(`drew ${amountArg}: spent is now ${after.spent} of ${after.cap}`)
console.log(`tx: ${signature}`)
