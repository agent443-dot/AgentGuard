import { CHAINS } from '@agentguard/shared'
import { tmpdir } from 'node:os'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Config } from '../config.js'
import { dbFile } from './client.js'

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const TEMP_DIRS = [tmpdir(), '/tmp', '/var/tmp', '/dev/shm']

/**
 * Where the database must not live once real money is on the line. Inside the repository it goes
 * with the next fresh checkout or redeploy, and a temp directory is cleared on reboot. Either way
 * the guard forgets the day's spend, so the daily max starts again from zero, and it forgets every
 * pending approval and the audit log with them.
 */
export function dbPlacementProblem(
  file: string,
  places: { repoRoot?: string; tempDirs?: string[]; cwd?: string } = {},
): string | undefined {
  if (file === ':memory:') {
    return 'DATABASE_URL is in memory and is lost when the process stops'
  }
  const path = resolve(places.cwd ?? process.cwd(), file)
  if (inside(path, places.repoRoot ?? REPO_ROOT)) {
    return 'DATABASE_URL is inside the repository; put it on a persistent volume'
  }
  if ((places.tempDirs ?? TEMP_DIRS).some((dir) => inside(path, dir))) {
    return 'DATABASE_URL is in a temporary directory; put it on a persistent volume'
  }
  return undefined
}

function inside(path: string, dir: string): boolean {
  const rel = relative(resolve(dir), path)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/** On mainnet a database that does not survive a redeploy would reset the day's spend to zero. */
export function requirePersistentDb(
  config: Config,
  places?: Parameters<typeof dbPlacementProblem>[1],
) {
  const mainnet =
    config.SOLANA_CHAIN === CHAINS.solanaMainnet ||
    config.BASE_CHAIN === CHAINS.base ||
    config.ROBINHOOD_CHAIN === CHAINS.robinhood
  const problem = mainnet ? dbPlacementProblem(dbFile(config.DATABASE_URL), places) : undefined
  if (problem !== undefined) {
    throw new Error(`invalid configuration: ${problem}`)
  }
}
