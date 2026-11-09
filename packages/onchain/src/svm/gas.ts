import type { HotWalletGas } from '@agentguard/shared'
import { ACCOUNT_SIZE } from '@solana/spl-token'
import type { Connection, PublicKey } from '@solana/web3.js'

// A signature costs 5,000 lamports; our transactions set no priority fee, and on x402 payments the
// facilitator pays the fees.
const SIGNATURE_FEE = 5_000n
const TRANSACTIONS = 10n

/**
 * The SOL a hot wallet has, and what a few draws and payments need, in lamports. A top-up creates
 * the hot wallet's own USDC account if it is missing, and a direct payment creates the recipient's,
 * each at one token account's rent, which the hot wallet pays. Two of those and ten transactions,
 * plus a quarter for margin: about 0.0052 SOL at today's rent.
 */
export async function hotWalletGas(
  connection: Connection,
  hotWallet: PublicKey,
): Promise<HotWalletGas> {
  const [balance, rent] = await Promise.all([
    connection.getBalance(hotWallet),
    connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE),
  ])
  const needed = 2n * BigInt(rent) + TRANSACTIONS * SIGNATURE_FEE
  return { balance: String(balance), minimum: String((needed * 5n) / 4n), symbol: 'SOL' }
}
