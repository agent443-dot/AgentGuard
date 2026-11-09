import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createInterface } from 'node:readline/promises'

export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

/**
 * Reads a secret without echoing it. On a terminal, raw mode keeps each key off the screen; from a
 * pipe (a password manager, say) the first line is the secret. Either way it never touches argv.
 */
export async function askSecret(question: string): Promise<string> {
  const stdin = process.stdin
  process.stderr.write(question)
  if (!stdin.isTTY) {
    let input = ''
    for await (const chunk of stdin) {
      input += String(chunk)
      if (input.includes('\n')) {
        break
      }
    }
    process.stderr.write('\n')
    return (input.split('\n')[0] ?? '').trim()
  }
  return new Promise((resolve, reject) => {
    let value = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          finish()
          resolve(value.trim())
          return
        }
        if (char === '\u0003') {
          finish()
          reject(new Error('cancelled'))
          return
        }
        value = char === '\u007f' || char === '\b' ? value.slice(0, -1) : value + char
      }
    }
    const finish = () => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      process.stderr.write('\n')
    }
    stdin.on('data', onData)
  })
}

/** The directory is the owner's only, and so is the file, even if it existed with looser bits. */
export function writeSecretFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  writeFileSync(path, `${content}\n`, { mode: 0o600 })
  chmodSync(path, 0o600)
}
