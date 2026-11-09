import { spawn } from 'node:child_process'
import { render, type Command } from '../domain/command.js'
import { stdinText, type Source, type Stdin } from '../domain/env.js'
import { WizardError } from '../domain/errors.js'

export interface Background {
  stop(): Promise<void>
}

export interface Runner {
  /** Runs to the end and returns stdout when captured. A non-zero exit throws. */
  run(command: Command): Promise<string>
  /** Starts a long-running child, such as `fly proxy`, for the caller to stop. */
  start(command: Command): Promise<Background>
}

export type SourceReader = (source: Source) => Promise<string>

/** The subcommand words only: they name what failed, and no value ever sits among them. */
function label(command: Command): string {
  return [command.cmd, ...command.args.filter((arg) => !arg.startsWith('-')).slice(0, 2)].join(' ')
}

/** What a command's stdin receives, read from its sources at the last moment. */
export async function stdinFor(stdin: Stdin, read: SourceReader): Promise<string> {
  const sources = 'raw' in stdin ? [stdin.raw] : stdin.env.map(([, source]) => source)
  const values = new Map<Source, string>()
  for (const source of sources) {
    values.set(source, await read(source))
  }
  return stdinText(stdin, (source) => values.get(source) ?? '')
}

function failure(command: Command, error: unknown): WizardError {
  const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT'
  return new WizardError(
    'COMMAND_FAILED',
    missing
      ? `${command.cmd} was not found: is it installed?`
      : `${label(command)} could not start`,
  )
}

export function processRunner(
  read: SourceReader,
  say: (line: string) => void,
  home: string,
): Runner {
  return {
    async run(command) {
      const text = command.stdin === undefined ? undefined : await stdinFor(command.stdin, read)
      if (!command.capture) {
        render(command, home).forEach((line) => say(line))
      }
      return new Promise((resolve, reject) => {
        const child = spawn(command.cmd, command.args, {
          cwd: command.cwd,
          shell: false,
          stdio: [
            text === undefined ? 'inherit' : 'pipe',
            command.capture ? 'pipe' : 'inherit',
            'inherit',
          ],
        })
        let out = ''
        child.stdout?.setEncoding('utf8').on('data', (chunk: string) => (out += chunk))
        child.on('error', (error) => reject(failure(command, error)))
        child.on('close', (code) => {
          if (code === 0) {
            resolve(out)
          } else {
            reject(
              new WizardError('COMMAND_FAILED', `${label(command)} failed (exit code ${code})`),
            )
          }
        })
        // A child that exits before reading its stdin gives EPIPE here; its exit code tells why.
        child.stdin?.on('error', () => {})
        child.stdin?.end(text)
      })
    },
    async start(command) {
      render(command, home).forEach((line) => say(line))
      const child = spawn(command.cmd, command.args, {
        cwd: command.cwd,
        shell: false,
        stdio: 'ignore',
      })
      const exited = new Promise<void>((resolve) => {
        child.on('close', () => resolve())
        child.on('error', () => resolve())
      })
      return {
        async stop() {
          if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGTERM')
          }
          await exited
        },
      }
    },
  }
}

/** Prints each command, runs none, and returns an empty stdout. */
export function dryRunner(say: (line: string) => void, home: string): Runner {
  return {
    async run(command) {
      render(command, home).forEach((line) => say(line))
      return ''
    },
    async start(command) {
      render(command, home).forEach((line) => say(line))
      say('    (in the background, stopped when the calls below are done)')
      return { stop: async () => {} }
    },
  }
}
