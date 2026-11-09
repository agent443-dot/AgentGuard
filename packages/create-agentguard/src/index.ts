import { randomBytes } from 'node:crypto'
import { homedir, userInfo } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import { diskFiles, dryFiles } from './adapters/files.js'
import { fetchHttp } from './adapters/http.js'
import { localKeys } from './adapters/keys.js'
import { terminalPrompter } from './adapters/prompt.js'
import { dryRunner, processRunner } from './adapters/runner.js'
import { sourceReader } from './adapters/sources.js'
import { chainVault } from './adapters/vault.js'
import { parseArgs, USAGE } from './domain/args.js'
import { WizardError } from './domain/errors.js'
import type { Ctx } from './steps/context.js'
import { doctor } from './steps/doctor.js'
import { setup } from './steps/wizard.js'

const say = (line = '') => process.stdout.write(`${line}\n`)

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  if (args.command === 'help') {
    say(USAGE)
    return 0
  }
  const home = homedir()
  const files = args.dryRun ? dryFiles(diskFiles, say, home) : diskFiles
  const prompt = terminalPrompter()
  const ctx: Ctx = {
    dry: args.dryRun,
    home,
    cwd: process.cwd(),
    username: userInfo().username,
    nodeVersion: process.versions.node,
    run: args.dryRun ? dryRunner(say, home) : processRunner(sourceReader(diskFiles), say, home),
    prompt,
    files,
    http: fetchHttp,
    vault: chainVault,
    keys: localKeys,
    say,
    sleep: (ms) => sleep(ms),
    now: () => Date.now(),
    token: () => randomBytes(32).toString('hex'),
  }
  try {
    if (args.command === 'doctor') {
      return await doctor(ctx, args.prefix)
    }
    await setup(ctx, args.prefix)
    return 0
  } finally {
    prompt.close()
  }
}

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error) {
  // Only a WizardError's message is known to carry no secret; any other could quote an RPC URL.
  say(
    error instanceof WizardError
      ? `\n✖ ${error.message}`
      : `\n✖ Unexpected ${error instanceof Error ? error.name : 'error'}. Your progress is saved: run create-agentguard again to continue.`,
  )
  process.exitCode = 1
}
