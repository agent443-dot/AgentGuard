import { AccountLayout, getAssociatedTokenAddressSync } from '@solana/spl-token'
import type { Connection, PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { USDC_DECIMALS } from '@agentguard/shared'
import { formatUnits } from '../../src/svm/transfer.js'
import { spendingLimitPda, VAULT_INDEX } from '../../src/svm/squads.js'
import { decode } from './plan.js'

/** What the proof page shows: a headline and the facts behind it, read from the chain only. */
export interface Proof {
  verified: boolean
  title: string
  lines: string[]
}

export interface SolanaProofRequest {
  cluster: string
  multisig: PublicKey
  /** Fixed when the page was built, as is the mint: never taken from the link. */
  hotWallet: PublicKey
  usdc: PublicKey
}

const DAY_S = 86_400

/**
 * A read the RPC refused or failed. Some RPCs refuse to list program accounts; without that list
 * the page could miss a spending right, so it never falls back to counting fewer of them.
 */
export const unreadable = (error: unknown): Proof => ({
  verified: false,
  title: 'Not verified',
  lines: [
    'This could not be verified: the RPC did not answer every read the proof needs, so the page ' +
      'cannot rule out a spending right it did not see.',
    `The RPC said: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
  ],
})
const usdcText = (amount: bigint) => `${formatUnits(amount, USDC_DECIMALS)} USDC`

/**
 * How much the hot wallet can draw from a Squads vault today, read from the chain. Every spending
 * limit on the multisig counts, not only the one the adapter derives: a second limit naming the hot
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
    return {
      verified: false,
      title: 'Not verified',
      lines: [`There is no Squads multisig at ${request.multisig.toBase58()} on ${cluster}.`],
    }
  }
  const [vault] = multisig.getVaultPda({ multisigPda: request.multisig, index: VAULT_INDEX })
  const [limits, balance] = await Promise.all([
    spendingLimits(connection, request.multisig),
    vaultBalance(connection, usdc, vault),
  ])
  const facts = [
    `Multisig ${request.multisig.toBase58()} on ${cluster}. Owner (config authority): ` +
      `${ms.configAuthority.toBase58()}. Members: ${ms.members.map((m) => m.key.toBase58()).join(', ')}, ` +
      `threshold ${ms.threshold}.`,
    `Vault ${vault.toBase58()} holds ${usdcText(balance)}.`,
  ]
  if (limits.length === 0) {
    return {
      verified: true,
      title: 'The most this agent can draw today: 0 USDC',
      lines: [
        'No spending limit: the hot wallet cannot draw from the vault. This is how a multisig looks ' +
          'after a kill, or before a limit is added.',
        ...facts,
      ],
    }
  }
  const ours = spendingLimitPda(request.multisig, hotWallet)
  const only = (keys: PublicKey[]) => keys.length === 1 && keys[0]!.equals(hotWallet)
  const problems = limits.flatMap(({ address, limit }) => {
    const found = []
    if (!address.equals(ours)) found.push('it is not the hot wallet limit the agent uses')
    if (!only(limit.members)) found.push(`its members are ${list(limit.members)}`)
    if (!only(limit.destinations)) found.push(`its destinations are ${list(limit.destinations)}`)
    if (!limit.mint.equals(usdc)) found.push(`its token is ${limit.mint.toBase58()}, not USDC`)
    return found.length ? [`Spending limit ${address.toBase58()}: ${found.join('; ')}.`] : []
  })
  if (problems.length > 0) {
    return {
      verified: false,
      title: 'Not verified',
      lines: [
        `This multisig's spending limits are not only the hot wallet ${hotWallet.toBase58()} ` +
          'drawing USDC into itself, so this page cannot say how much can be drawn.',
        ...problems,
        ...facts,
      ],
    }
  }
  const { limit } = limits[0]!
  const cap = BigInt(limit.amount.toString())
  const lastReset = Number(limit.lastReset.toString())
  // Squads refills the limit lazily, on the first draw after a day has passed.
  const refilled = now / 1000 - lastReset > DAY_S
  const left = refilled ? cap : BigInt(limit.remainingAmount.toString())
  const most = left < balance ? left : balance
  return {
    verified: true,
    title: `The most this agent can draw today: ${usdcText(most)}`,
    lines: [
      `Verified from the chain: one spending limit, ${ours.toBase58()}, lets only the hot wallet ` +
        `${hotWallet.toBase58()} draw, and only into itself.`,
      `Daily cap: ${usdcText(cap)}. Left today: ${usdcText(left)}` +
        (refilled
          ? ', the full cap, because a day has passed since the last reset.'
          : `. It resets at ${new Date((lastReset + DAY_S) * 1000).toISOString()}.`),
      ...facts,
      ...(balance < left
        ? ['The vault holds less than is left today, so the vault is the limit.']
        : []),
    ],
  }
}

const list = (keys: PublicKey[]) => keys.map((key) => key.toBase58()).join(', ') || '(any)'

/** Every Squads spending limit whose multisig field is this one. */
async function spendingLimits(connection: Connection, multisigPda: PublicKey) {
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
