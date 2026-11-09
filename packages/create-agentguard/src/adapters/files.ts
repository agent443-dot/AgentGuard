import { chmod, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tilde } from '../domain/env.js'
import { WizardError } from '../domain/errors.js'

export interface Files {
  exists(path: string): Promise<boolean>
  read(path: string): Promise<string>
  /** File names in a directory, or none when it does not exist. */
  list(dir: string): Promise<string[]>
  /** Creates it if needed and makes it 0700 either way. */
  ensureDir(dir: string): Promise<void>
  /** Always 0600. With `create`, an existing file is refused: a key is never overwritten. */
  write(path: string, contents: string, options?: { create?: boolean }): Promise<void>
}

function isCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

export const diskFiles: Files = {
  async exists(path) {
    try {
      await stat(path)
      return true
    } catch (error) {
      if (isCode(error, 'ENOENT')) {
        return false
      }
      throw error
    }
  },
  read: (path) => readFile(path, 'utf8'),
  async list(dir) {
    try {
      return await readdir(dir)
    } catch (error) {
      if (isCode(error, 'ENOENT')) {
        return []
      }
      throw error
    }
  },
  async ensureDir(dir) {
    await mkdir(dir, { recursive: true, mode: 0o700 })
    await chmod(dir, 0o700)
  },
  async write(path, contents, options = {}) {
    try {
      await writeFile(path, contents, { mode: 0o600, flag: options.create ? 'wx' : 'w' })
    } catch (error) {
      if (isCode(error, 'EEXIST')) {
        throw new WizardError(
          'KEY_EXISTS',
          `${path} already exists, and the wizard never overwrites it`,
        )
      }
      throw error
    }
    // The mode above applies only to a file it creates.
    await chmod(path, 0o600)
  },
}

/** Reads as usual and writes nothing, saying what it would have written. */
export function dryFiles(base: Files, say: (line: string) => void, home: string): Files {
  return {
    exists: base.exists,
    read: base.read,
    list: base.list,
    async ensureDir(dir) {
      say(`  would create ${tilde(dir, home)}/ (0700)`)
    },
    async write(path) {
      say(`  would write ${tilde(path, home)} (0600)`)
    },
  }
}
