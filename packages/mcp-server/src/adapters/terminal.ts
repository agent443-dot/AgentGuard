import { randomBytes } from 'node:crypto'
import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
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

export class SecretFileError extends Error {}

/**
 * Writes a fresh file in a directory only the owner can enter, then renames it into place: nothing
 * follows a planted symlink, and no reader ever sees the token in a file with looser bits.
 */
export function writeSecretFile(path: string, content: string): void {
  const dir = dirname(path)
  privateDir(dirname(dir))
  privateDir(dir)
  const temp = join(dir, `.${basename(path)}.${randomBytes(6).toString('hex')}`)
  const fd = openSync(
    temp,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0),
    0o600,
  )
  try {
    writeFileSync(fd, `${content}\n`)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  try {
    renameSync(temp, path)
  } catch (error) {
    rmSync(temp, { force: true })
    throw error
  }
}

export function fileExists(path: string): boolean {
  return existsSync(path)
}

function privateDir(dir: string): void {
  try {
    mkdirSync(dir, { mode: 0o700 })
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw error
    }
  }
  const stat = lstatSync(dir)
  if (!stat.isDirectory()) {
    throw new SecretFileError(`${dir} is not a directory`)
  }
  // Mode bits mean nothing on Windows; there the folder's ACL is the user's to set.
  if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
    throw new SecretFileError(`${dir} is open to other users: run chmod 700 on it`)
  }
}
