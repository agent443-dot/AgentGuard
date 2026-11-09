import { USDC_DECIMALS } from '@agentguard/shared'
import { AccountLayout, getAssociatedTokenAddressSync } from '@solana/spl-token'
import type { Connection, PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { spendingLimitPda, VAULT_INDEX } from '../../src/svm/squads.js'
import { formatUnits } from '../../src/svm/transfer.js'
import { decode } from './plan.js'

/** What the proof page shows: a headline and the facts behind it, read from the chain only. */
export interface Proof {
  verified: boolean
  title: string
  lines: string[]
}

export const notVerified = (lines: string[]): Proof => ({
  verified: false,
  title: 'Not verified',
  lines,
})

/**
 * A read the RPC refused or failed. Some RPCs refuse to list program accounts; without that list
 * the page could miss a spending right, so it never falls back to counting fewer of them.
 */
export const unreadable = (error: unknown): Proof =>
  notVerified([
    'This could not be verified: the RPC did not answer every read the proof needs, so the page ' +
      'cannot rule out a spending right it did not see.',
    `The RPC said: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
  ])

export interface Window {
  /** What can still be drawn before the next reset. */
  left: bigint
  cap: bigint
  resetsAt: Date
  balance: bigint
  format: (amount: bigint) => string
  facts: string[]
  verifiedBy: string
}

/**
 * The most the agent can draw in the next 24 hours: what is left before the reset, and the whole
 * cap again after it, which always falls within a day. The vault's balance bounds both.
 */
export function window({ left, cap, resetsAt, balance, format, facts, verifiedBy }: Window): Proof {
  const day = left + cap
  const most = day < balance ? day : balance
  return {
    verified: true,
    title: `The most this agent can draw in the next 24 hours: ${format(most)}`,
    lines: [
      verifiedBy,
      `Left until ${resetsAt.toISOString()}: ${format(left)}. Then the daily cap again: ` +
        `${format(cap)}.`,
      ...facts,
      ...(balance < day ? ['The vault holds less than that, so the vault is the limit.'] : []),
    ],
  }
}

export interface SolanaProofRequest {
  cluster: string
  multisig: PublicKey
  /** Fixed when the page was built, as is the mint: never taken from the link. */
  hotWallet: PublicKey
  usdc: PublicKey
}

const DAY_S = 86_400n
const usdcText = (amount: bigint) => `${formatUnits(amount, USDC_DECIMALS)} USDC`

/**
 * How much the hot wallet can draw from a Squads vault, read from the chain. Every spending limit
 * on the multisig counts, not only the one the adapter derives: a second limit naming the hot
 * wallet would let it draw more, and one naming anyone else is a key that can draw too.
 */
export async function proveSolana(
  connection: Connection,
  request: SolanaProofRequest,
  now = Date.now(),
): Promise<Proof> {
  const { cluster, hotWallet, usdc } = request
  const ms = decode(await connection.getAccountInfo(request.multisig), multisig.accounts.Multisig)
  if (!ms) {
    return notVerified([
      `There is no Squads multisig at ${request.multisig.toBase58()} on ${cluster}.`,
    ])
  }
  const [vault] = multisig.getVaultPda({ multisigPda: request.multisig, index: VAULT_INDEX })
  const [limits, balance] = await Promise.all([
    spendingLimits(connection, request.multisig),
    vaultBalance(connection, usdc, vault),
  ])
  const facts = [
    `Multisig ${request.multisig.toBase58()} on ${cluster}. Owner (config authority): ` +
      `${ms.configAuthority.toBase58()}. Members: ${list(ms.members.map((m) => m.key))}, ` +
      `threshold ${ms.threshold}.`,
    `Vault ${vault.toBase58()} holds ${usdcText(balance)}.`,
  ]
  const problems = [
    ...ownerProblems(ms, hotWallet),
    ...limits.flatMap((l) => limitProblems(l, request)),
  ]
  if (problems.length > 0) {
    return notVerified([
      `This multisig is not only its owner's, with the hot wallet ${hotWallet.toBase58()} drawing ` +
        'USDC into itself under one daily limit, so this page cannot say how much can be drawn.',
      ...problems,
      ...facts,
    ])
  }
  if (limits.length === 0) {
    return {
      verified: true,
      title: 'The most this agent can draw in the next 24 hours: 0 USDC',
      lines: [
        'No spending limit: the hot wallet cannot draw from the vault. This is how a multisig looks ' +
          'after a kill, or before a limit is added.',
        ...facts,
      ],
    }
  }
  const { address, limit } = limits[0]!
  return window({
    ...today(limit, BigInt(Math.floor(now / 1000))),
    cap: BigInt(limit.amount.toString()),
    balance,
    format: usdcText,
    facts,
    verifiedBy:
      `Verified from the chain: one daily spending limit, ${address.toBase58()}, lets only the hot ` +
      `wallet ${hotWallet.toBase58()} draw, and only into itself.`,
  })
}

/** Only the owner may run the multisig, and the hot wallet must not be that owner. */
function ownerProblems(ms: multisig.accounts.Multisig, hotWallet: PublicKey): string[] {
  const owner = ms.configAuthority
  const problems = []
  if (owner.equals(hotWallet)) {
    problems.push('The hot wallet is the config authority: it can change the limits itself.')
  }
  if (ms.members.length !== 1 || !ms.members[0]!.key.equals(owner)) {
    problems.push(
      `Its members are ${list(ms.members.map((m) => m.key))}, not only the config authority: ` +
        'members can move the vault through proposals.',
    )
  }
  return problems
}

interface Found {
  address: PublicKey
  limit: multisig.accounts.SpendingLimit
}

function limitProblems({ address, limit }: Found, request: SolanaProofRequest): string[] {
  const { hotWallet, usdc } = request
  const only = (keys: PublicKey[]) => keys.length === 1 && keys[0]!.equals(hotWallet)
  const found = []
  if (!address.equals(spendingLimitPda(request.multisig, hotWallet))) {
    found.push('it is not the hot wallet limit the agent uses')
  }
  if (!only(limit.members)) found.push(`its members are ${list(limit.members)}`)
  if (!only(limit.destinations)) found.push(`its destinations are ${list(limit.destinations)}`)
  if (!limit.mint.equals(usdc)) found.push(`its token is ${limit.mint.toBase58()}, not USDC`)
  if (limit.period !== multisig.generated.Period.Day) found.push('it does not reset daily')
  if (limit.vaultIndex !== VAULT_INDEX) found.push(`it draws on vault ${limit.vaultIndex}`)
  return found.length ? [`Spending limit ${address.toBase58()}: ${found.join('; ')}.`] : []
}

/**
 * Squads refills a limit lazily, on the first draw after a period has passed, and then moves its
 * reset forward by whole periods, so the next refill is always less than a day away.
 */
function today(limit: multisig.accounts.SpendingLimit, nowS: bigint) {
  const lastReset = BigInt(limit.lastReset.toString())
  const passed = nowS - lastReset
  if (passed > DAY_S) {
    const start = lastReset + (passed / DAY_S) * DAY_S
    return { left: BigInt(limit.amount.toString()), resetsAt: seconds(start + DAY_S) }
  }
  return { left: BigInt(limit.remainingAmount.toString()), resetsAt: seconds(lastReset + DAY_S) }
}

const seconds = (s: bigint) => new Date(Number(s) * 1000)
const list = (keys: PublicKey[]) => keys.map((key) => key.toBase58()).join(', ') || '(any)'

/** Every Squads spending limit whose multisig field is this one. */
async function spendingLimits(connection: Connection, multisigPda: PublicKey): Promise<Found[]> {
  const accounts = await connection.getProgramAccounts(multisig.PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 0,
          encoding: 'base64',
          bytes: Buffer.from(multisig.accounts.spendingLimitDiscriminator).toString('base64'),
        },
      },
      { memcmp: { offset: 8, bytes: multisigPda.toBase58() } },
    ],
  })
  return accounts.map(({ pubkey, account }) => ({
    address: pubkey,
    limit: multisig.accounts.SpendingLimit.fromAccountInfo(account)[0],
  }))
}

async function vaultBalance(connection: Connection, usdc: PublicKey, vault: PublicKey) {
  const info = await connection.getAccountInfo(getAssociatedTokenAddressSync(usdc, vault, true))
  return info ? AccountLayout.decode(info.data).amount : 0n
}
