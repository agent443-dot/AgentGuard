import type { SimulationResult } from '@agentguard/shared'
import { TOKEN_PROGRAM_ID, unpackAccount, type Account } from '@solana/spl-token'
import {
  PublicKey,
  VersionedTransaction,
  type AccountInfo,
  type Connection,
  type SimulatedTransactionAccountInfo,
  type VersionedMessage,
} from '@solana/web3.js'
import type { SimulationOutcome } from '../ChainAdapter.js'
import { inspectTransfer } from './inspect.js'
import { checkEffects, expectedTransfer, formatUnits, type Payment } from './transfer.js'

/**
 * The static inspection first, then the chain's own verdict on the balances. A message the
 * inspection refuses is never simulated: there is nothing a simulation could say to redeem it.
 *
 * The balances before are read a moment before the simulation runs, so a payment landing in
 * between makes this refuse a good transaction. That is the side to err on.
 */
export async function simulateMessage(
  connection: Connection,
  message: VersionedMessage,
  payment: Payment,
): Promise<SimulationOutcome> {
  const expected = expectedTransfer(payment)
  const simulation = describe(payment)

  const inspected = inspectTransfer(message, expected)
  if (inspected.length > 0) {
    return { simulation, rejectReasons: inspected }
  }

  const watched = [expected.source, expected.destination]
  const [sourceBefore, destinationBefore] = await connection.getMultipleAccountsInfo(watched)
  const { value } = await connection.simulateTransaction(new VersionedTransaction(message), {
    sigVerify: false,
    replaceRecentBlockhash: true,
    accounts: { encoding: 'base64', addresses: watched.map((key) => key.toBase58()) },
  })
  if (value.err || !value.accounts) {
    return { simulation, rejectReasons: ['SIM_FAILED'] }
  }

  const [sourceAfter, destinationAfter] = value.accounts
  try {
    const before = {
      source: tokenAccount(expected.source, sourceBefore),
      destination: tokenAccount(expected.destination, destinationBefore),
    }
    const after = {
      source: tokenAccount(expected.source, simulated(sourceAfter)),
      destination: tokenAccount(expected.destination, simulated(destinationAfter)),
    }
    return { simulation, rejectReasons: checkEffects(before, after, payment) }
  } catch {
    // Not a token account of the classic program: whatever it is, it is not the payment agreed.
    return { simulation, rejectReasons: ['SIM_UNEXPECTED_EFFECT'] }
  }
}

function describe(payment: Payment): SimulationResult {
  const amount = formatUnits(payment.amount, payment.decimals)
  return {
    summary: `pays ${amount} USDC from ${payment.hotWallet.toBase58()} to ${payment.recipient.toBase58()}`,
    balanceChanges: [{ token: payment.mint.toBase58(), delta: (-payment.amount).toString() }],
  }
}

function simulated(
  account: SimulatedTransactionAccountInfo | null | undefined,
): AccountInfo<Buffer> | null {
  if (!account) {
    return null
  }
  const [data] = account.data
  return {
    data: Buffer.from(data ?? '', 'base64'),
    owner: new PublicKey(account.owner),
    lamports: account.lamports,
    executable: account.executable,
  }
}

function tokenAccount(
  address: PublicKey,
  info: AccountInfo<Buffer> | null | undefined,
): Account | null {
  return info ? unpackAccount(address, info, TOKEN_PROGRAM_ID) : null
}
