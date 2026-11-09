import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { WizardError } from '../domain/errors.js'

export interface Question<T> {
  text: string
  default?: string
  /** Typed characters are not echoed: for the bot token. */
  hidden?: boolean
  /** Throws a WizardError to have the question asked again, with its message. */
  parse: (raw: string) => T
}

export interface Prompter {
  ask<T>(question: Question<T>): Promise<T>
  close(): void
}

export function terminalPrompter(): Prompter {
  let muted = false
  // readline echoes what is typed through its output; muting that stream hides a hidden answer.
  const output = new Writable({
    write(chunk: Buffer, _encoding, done) {
      if (!muted) {
        process.stdout.write(chunk)
      }
      done()
    },
  })
  const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY })
  rl.setPrompt('> ')
  // Lines are queued rather than read with rl.question: piped answers arrive all at once, before
  // the questions they answer.
  const lines: string[] = []
  let closed = false
  let waiting: ((line: string | undefined) => void) | undefined
  rl.on('line', (line) => (waiting === undefined ? lines.push(line) : waiting(line)))
  rl.on('close', () => {
    closed = true
    waiting?.(undefined)
  })
  rl.on('SIGINT', () => {
    process.stdout.write('\nStopped. Run create-agentguard again to continue from here.\n')
    process.exit(130)
  })
  const next = (): Promise<string | undefined> => {
    if (lines.length > 0 || closed) {
      return Promise.resolve(lines.shift())
    }
    return new Promise((resolve) => {
      waiting = (line) => {
        waiting = undefined
        resolve(line)
      }
    })
  }

  return {
    async ask<T>(question: Question<T>): Promise<T> {
      for (;;) {
        const hint = question.default ? ` [${question.default}]` : ''
        process.stdout.write(`\n${question.text}${hint}\n`)
        rl.prompt()
        muted = question.hidden === true
        const raw = await next()
        muted = false
        if (raw === undefined) {
          throw new WizardError(
            'INVALID_INPUT',
            'the input ended before every question was answered',
          )
        }
        if (question.hidden || !process.stdin.isTTY) {
          process.stdout.write('\n')
        }
        try {
          return question.parse(raw.trim() === '' ? (question.default ?? '') : raw)
        } catch (error) {
          if (!(error instanceof WizardError)) {
            throw error
          }
          process.stdout.write(`  ${error.message}\n`)
        }
      }
    },
    close: () => rl.close(),
  }
}
