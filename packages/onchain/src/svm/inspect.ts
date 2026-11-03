import type { RejectCode } from '@agentguard/shared'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  decodeTransferCheckedInstruction,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TokenInstruction,
} from '@solana/spl-token'
import {
  ComputeBudgetInstruction,
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
  type VersionedMessage,
} from '@solana/web3.js'

/** What the transaction must do, and nothing else. */
export interface ExpectedTransfer {
  feePayer: PublicKey
  /** The hot wallet: the only key allowed to move the tokens. */
  authority: PublicKey
  /** The hot wallet's token account. */
  source: PublicKey
  /** The recipient's token account. */
  destination: PublicKey
  mint: PublicKey
  amount: bigint
  decimals: number
}

// Generous for one transfer, small enough that a priority fee cannot become a way to drain the fee
// payer: at the ceiling it costs 0.0004 SOL.
const MAX_COMPUTE_UNIT_LIMIT = 400_000
const MAX_MICRO_LAMPORTS_PER_UNIT = 1_000_000n

// The x402 exact scheme appends a memo to every payment, a random nonce when the seller sets none,
// so a memo has to pass. 256 bytes is the x402 client's own ceiling.
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
const MAX_MEMO_BYTES = 256

/**
 * Reads the exact message we are about to sign and lists every reason not to.
 *
 * A payment that also grants standing authority is the attack this exists for: one small transfer
 * bundled with an Approve, a SetAuthority or a CloseAccount turns a single payment into lasting
 * control of the wallet. Default deny: an instruction we do not recognise is a reason on its own.
 */
export function inspectTransfer(
  message: VersionedMessage,
  expected: ExpectedTransfer,
): RejectCode[] {
  // Accounts behind a lookup table are not visible in the message itself, so nothing below could be
  // trusted about them.
  if (message.addressTableLookups.length > 0) {
    return ['HIDDEN_ACCOUNTS_DETECTED']
  }

  const keys = message.staticAccountKeys
  const reasons = new Set<RejectCode>()
  let matchingTransfers = 0
  let memos = 0

  if (!keys[0]?.equals(expected.feePayer)) {
    reasons.add('SIM_UNEXPECTED_EFFECT')
  }

  for (const compiled of message.compiledInstructions) {
    const programId = keys[compiled.programIdIndex]
    if (programId === undefined) {
      reasons.add('SIM_UNEXPECTED_EFFECT')
      continue
    }
    const instruction = new TransactionInstruction({
      programId,
      data: Buffer.from(compiled.data),
      keys: compiled.accountKeyIndexes.map((index) => ({
        pubkey: keys[index] ?? programId,
        isSigner: message.isAccountSigner(index),
        isWritable: message.isAccountWritable(index),
      })),
    })

    if (programId.equals(TOKEN_PROGRAM_ID) || programId.equals(TOKEN_2022_PROGRAM_ID)) {
      const outcome = checkToken(instruction, programId, expected)
      if (outcome === 'match') {
        matchingTransfers++
      } else {
        reasons.add(outcome)
      }
    } else if (programId.equals(ComputeBudgetProgram.programId)) {
      if (!computeBudgetWithinLimits(instruction)) {
        reasons.add('SIM_UNEXPECTED_EFFECT')
      }
    } else if (programId.equals(MEMO_PROGRAM_ID)) {
      // A memo with accounts makes the memo program demand their signatures, which is no payment's
      // business. The client writes one; a second has no reason to be there.
      memos++
      if (memos > 1 || instruction.keys.length > 0 || instruction.data.length > MAX_MEMO_BYTES) {
        reasons.add('SIM_UNEXPECTED_EFFECT')
      }
    } else if (programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
      if (!createsExpectedDestination(instruction, expected)) {
        reasons.add('SIM_UNEXPECTED_EFFECT')
      }
    } else {
      reasons.add('UNKNOWN_PROGRAM_DETECTED')
    }
  }

  // Exactly one: a second matching transfer is a second payment, and zero means the money goes
  // somewhere we did not agree to.
  if (matchingTransfers !== 1) {
    reasons.add('SIM_UNEXPECTED_EFFECT')
  }
  return [...reasons]
}

function checkToken(
  instruction: TransactionInstruction,
  programId: PublicKey,
  expected: ExpectedTransfer,
): RejectCode | 'match' {
  switch (instruction.data[0]) {
    case TokenInstruction.Approve:
    case TokenInstruction.ApproveChecked:
      return 'DELEGATE_DETECTED'
    case TokenInstruction.SetAuthority:
      return 'AUTHORITY_CHANGE_DETECTED'
    case TokenInstruction.CloseAccount:
      return 'ACCOUNT_CLOSE_DETECTED'
    case TokenInstruction.TransferChecked:
      return transferMatches(instruction, programId, expected) ? 'match' : 'SIM_UNEXPECTED_EFFECT'
    default:
      // Includes the unchecked Transfer: without the mint and decimals in the instruction we cannot
      // bind it to USDC, so it is refused rather than reasoned about.
      return 'SIM_UNEXPECTED_EFFECT'
  }
}

function transferMatches(
  instruction: TransactionInstruction,
  programId: PublicKey,
  expected: ExpectedTransfer,
): boolean {
  let decoded: ReturnType<typeof decodeTransferCheckedInstruction>
  try {
    decoded = decodeTransferCheckedInstruction(instruction, programId)
  } catch {
    return false
  }
  const { keys, data } = decoded
  return (
    keys.source.pubkey.equals(expected.source) &&
    keys.mint.pubkey.equals(expected.mint) &&
    keys.destination.pubkey.equals(expected.destination) &&
    keys.owner.pubkey.equals(expected.authority) &&
    keys.multiSigners.length === 0 &&
    data.amount === expected.amount &&
    data.decimals === expected.decimals
  )
}

function computeBudgetWithinLimits(instruction: TransactionInstruction): boolean {
  try {
    switch (ComputeBudgetInstruction.decodeInstructionType(instruction)) {
      case 'SetComputeUnitLimit':
        return (
          ComputeBudgetInstruction.decodeSetComputeUnitLimit(instruction).units <=
          MAX_COMPUTE_UNIT_LIMIT
        )
      case 'SetComputeUnitPrice':
        return (
          BigInt(ComputeBudgetInstruction.decodeSetComputeUnitPrice(instruction).microLamports) <=
          MAX_MICRO_LAMPORTS_PER_UNIT
        )
      default:
        return false
    }
  } catch {
    return false
  }
}

/**
 * Creating the recipient's token account is the one associated-token instruction a legitimate
 * payment needs. Its account list is payer, account, owner, mint: the account must be the one the
 * transfer pays into, for the mint we expect.
 */
function createsExpectedDestination(
  instruction: TransactionInstruction,
  expected: ExpectedTransfer,
): boolean {
  const createKinds =
    instruction.data.length === 0 || (instruction.data.length === 1 && instruction.data[0] === 1)
  const account = instruction.keys[1]?.pubkey
  const mint = instruction.keys[3]?.pubkey
  return createKinds && !!account?.equals(expected.destination) && !!mint?.equals(expected.mint)
}
