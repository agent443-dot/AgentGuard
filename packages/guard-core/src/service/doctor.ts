import type { ChainAdapter } from '@agentguard/onchain'
import type { Amount, ChainId, DoctorCheck, HotWalletGas } from '@agentguard/shared'
import { readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { dbFile, type Db } from '../db/client.js'
import * as repo from '../db/repo.js'
import { auditLog } from '../db/schema.js'
import { parseAmount } from '../domain/amount.js'

const BACKUP_MAX_AGE_MS = 2 * 86_400_000
const READ_TIMEOUT_MS = 5_000

/** Onchain's adapters gain getHotWalletGas in a release that is not on main yet. */
type WithGas = ChainAdapter & { getHotWalletGas?: () => Promise<HotWalletGas> }

export interface DoctorDeps {
  db: Db
  chains: ReadonlyMap<ChainId, ChainAdapter>
  usdc: ReadonlyMap<ChainId, string>
  fetch: typeof fetch
  now: () => Date
  botUrl: string
  databaseUrl: string
  passkeyAbove?: Amount | undefined
}

/**
 * What an owner without a terminal needs to know is working. Every message is plain English and
 * names no URL, key or token: the answer is shown in Telegram, which is not a safe place for them.
 */
export async function doctor(deps: DoctorDeps): Promise<DoctorCheck[]> {
  const chains = await Promise.all(
    [...deps.chains.values()].map((adapter) => chainChecks(deps, adapter)),
  )
  return [
    database(deps),
    ...chains.flat(),
    ...passkeyChecks(deps),
    await bot(deps),
    await backup(deps),
  ]
}

class Rollback extends Error {}

function database({ db, now }: { db: Db; now: () => Date }): DoctorCheck {
  try {
    // A real write, undone: the check must not leave a trace in the log it is checking.
    db.transaction((tx) => {
      tx.insert(auditLog).values({ at: now().toISOString(), event: 'doctor_write_check' }).run()
      throw new Rollback()
    })
  } catch (error) {
    if (error instanceof Rollback) {
      return { id: 'database', status: 'ok', message: 'The database accepts writes.' }
    }
  }
  return {
    id: 'database',
    status: 'fail',
    message: 'The database refuses writes, so no payment can be recorded or made.',
    fix: 'Check that the volume holding the database is mounted, writable and not full.',
  }
}

async function chainChecks(deps: DoctorDeps, adapter: ChainAdapter): Promise<DoctorCheck[]> {
  const { chain } = adapter
  return [
    await attempt(`${chain}:allowance`, async () => {
      const allowance = await adapter.getAllowanceState()
      return allowance.status === 'active'
        ? { status: 'ok', message: `The onchain daily limit on ${chain} is in place.` }
        : {
            status: 'warn',
            message: `There is no onchain limit on ${chain}, so the hot wallet can draw nothing.`,
            fix: 'If this follows a kill, set the limit up again before paying on this chain.',
          }
    }),
    await attempt(`${chain}:gas`, async () => {
      const gas = await (adapter as WithGas).getHotWalletGas?.()
      if (gas === undefined) {
        return { status: 'ok', message: `The hot wallet's gas on ${chain} is not reported.` }
      }
      return parseAmount(gas.balance) < parseAmount(gas.minimum)
        ? {
            status: 'warn',
            message: `The hot wallet on ${chain} is low on ${gas.symbol} for fees.`,
            fix: `Send some ${gas.symbol} to the hot wallet's address.`,
          }
        : { status: 'ok', message: `The hot wallet on ${chain} has enough ${gas.symbol} for fees.` }
    }),
    await attempt(`${chain}:balance`, async () => {
      const token = deps.usdc.get(chain)
      if (token === undefined) {
        return { status: 'warn', message: `No dollar token is configured for ${chain}.` }
      }
      const balance = await adapter.getHotWalletBalance(token)
      return { status: 'ok', message: `The hot wallet on ${chain} holds ${balance} atomic units.` }
    }),
  ]
}

/** A check whose read throws fails, and says which read, never the error text: it may hold a URL. */
async function attempt(
  id: string,
  check: () => Promise<Omit<DoctorCheck, 'id'>>,
): Promise<DoctorCheck> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), READ_TIMEOUT_MS)
  })
  try {
    // A hung RPC must not hang the whole report: the owner is waiting on it in Telegram.
    return { id, ...(await Promise.race([check(), timeout])) }
  } catch {
    const [chain] = id.split(':')
    return {
      id,
      status: 'fail',
      message: `guard-core could not read this from ${chain}.`,
      fix: 'Check that the RPC URL for this chain is set and reachable.',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * An agent whose approval threshold is above PASSKEY_ABOVE never asks for a passkey on the
 * amounts between the two: those pay without the owner at all.
 */
function passkeyChecks(deps: DoctorDeps): DoctorCheck[] {
  const above = deps.passkeyAbove
  if (above === undefined) {
    return []
  }
  return repo.agentIds(deps.db).flatMap((agentId): DoctorCheck[] => {
    const threshold = repo.getPolicy(deps.db, agentId)?.approvalThreshold
    return threshold !== undefined && parseAmount(above) < parseAmount(threshold)
      ? [
          {
            id: `${agentId}:passkey`,
            status: 'warn',
            message: `Payments by ${agentId} below its approval threshold skip the owner, even those above the passkey amount.`,
            fix: `Lower ${agentId}'s approval threshold to the passkey amount or below.`,
          },
        ]
      : []
  })
}

async function bot(deps: DoctorDeps): Promise<DoctorCheck> {
  try {
    const response = await deps.fetch(`${deps.botUrl}/health`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (response.ok) {
      return { id: 'bot', status: 'ok', message: 'The Telegram bot answers.' }
    }
  } catch {
    // Reported below, the same as a bad status.
  }
  return {
    id: 'bot',
    status: 'fail',
    message: 'The Telegram bot does not answer, so approvals and alerts cannot reach the owner.',
    fix: 'Check that the bot is running and that BOT_URL points at it.',
  }
}

async function backup(deps: DoctorDeps): Promise<DoctorCheck> {
  const file = dbFile(deps.databaseUrl)
  const none: DoctorCheck = {
    id: 'backup',
    status: 'warn',
    message: 'No database backup was found.',
    fix: 'Run the database backup, and schedule it daily.',
  }
  if (file === ':memory:') {
    return none
  }
  const dir = join(dirname(file), 'backups')
  let newest = 0
  try {
    for (const name of await readdir(dir)) {
      newest = Math.max(newest, (await stat(join(dir, name))).mtimeMs)
    }
  } catch {
    return none
  }
  if (newest === 0) {
    return none
  }
  return deps.now().getTime() - newest > BACKUP_MAX_AGE_MS
    ? {
        id: 'backup',
        status: 'warn',
        message: 'The newest database backup is more than two days old.',
        fix: 'Run the database backup, and check the daily schedule.',
      }
    : { id: 'backup', status: 'ok', message: 'A database backup from the last two days exists.' }
}
