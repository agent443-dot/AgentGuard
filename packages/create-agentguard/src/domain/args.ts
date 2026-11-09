import { check, prefixSchema } from './answers.js'
import { WizardError } from './errors.js'

export interface Args {
  command: 'setup' | 'doctor' | 'help'
  dryRun: boolean
  prefix?: string
}

export const USAGE = `Usage: create-agentguard [doctor] [--dry-run] [--prefix <name>]

  (no command)   set up AgentGuard on Fly.io and Vercel, or continue a setup
  doctor         check a running AgentGuard and say how to fix what is wrong
  --dry-run      print every command instead of running it, and write nothing
  --prefix       which setup, when ~/.agentguard holds more than one`

export function parseArgs(argv: string[]): Args {
  const args: Args = { command: 'setup', dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === 'doctor' && i === 0) {
      args.command = 'doctor'
    } else if (arg === '--help' || arg === '-h') {
      args.command = 'help'
    } else if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--prefix') {
      args.prefix = check(prefixSchema, argv[++i] ?? '')
    } else {
      throw new WizardError('INVALID_INPUT', `unknown argument ${arg}\n\n${USAGE}`)
    }
  }
  return args
}
