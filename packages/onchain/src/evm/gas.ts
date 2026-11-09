import type { Address, PublicClient } from 'viem'
import type { HotWalletGas } from '../svm/gas.js'

// One executeAllowanceTransfer or token transfer, with room to spare. On Robinhood Chain, an
// Arbitrum chain, the gas a transaction uses includes its share of the L1 data cost, so the figure
// is well above the ~80k an L1 draw uses.
const GAS_PER_CALL = 250_000n
const CALLS = 4n

/**
 * The native coin a hot wallet needs for a few draws and payments at today's fees, and what it
 * has. Amounts are wei.
 */
export async function hotWalletGas(client: PublicClient, hot: Address): Promise<HotWalletGas> {
  const [balance, fees] = await Promise.all([
    client.getBalance({ address: hot }),
    client.estimateFeesPerGas(),
  ])
  return {
    balance: balance.toString(),
    minimum: (fees.maxFeePerGas * GAS_PER_CALL * CALLS).toString(),
    symbol: client.chain?.nativeCurrency.symbol ?? 'ETH',
  }
}
