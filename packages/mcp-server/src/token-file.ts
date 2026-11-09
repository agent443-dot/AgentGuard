import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs'

export interface TokenFile {
  regular: boolean
  mode: number
  read: () => string
}

export interface TokenFileIo {
  open: (path: string) => TokenFile
  platform: NodeJS.Platform
}

/** One open handle, so what is checked is what is read, even if the path is swapped meanwhile. */
function open(path: string): TokenFile {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const stat = fstatSync(fd)
    const content = stat.isFile() ? readFileSync(fd, 'utf8') : ''
    return { regular: stat.isFile(), mode: stat.mode, read: () => content }
  } finally {
    closeSync(fd)
  }
}

const nodeIo: TokenFileIo = { open, platform: process.platform }

/**
 * Lets a client config name a file instead of holding the agent token, so the token is in no
 * config, argv or shell history. A non-empty AGENT_TOKEN wins. Like ssh with a private key, a file
 * that others can read is refused rather than used.
 */
export function withTokenFile(env: NodeJS.ProcessEnv, io: TokenFileIo = nodeIo): NodeJS.ProcessEnv {
  const path = env['AGENT_TOKEN_FILE']
  if (env['AGENT_TOKEN'] || !path) {
    return env
  }
  let file: TokenFile
  try {
    file = io.open(path)
  } catch {
    throw new TokenFileError(`AGENT_TOKEN_FILE ${path} could not be read`)
  }
  if (!file.regular) {
    throw new TokenFileError(`AGENT_TOKEN_FILE ${path} is not a regular file`)
  }
  // Mode bits mean nothing on Windows; there the file's ACL is the user's to set.
  if (io.platform !== 'win32' && (file.mode & 0o077) !== 0) {
    throw new TokenFileError(`AGENT_TOKEN_FILE ${path} is readable by others: run chmod 600 on it`)
  }
  return { ...env, AGENT_TOKEN: file.read().trim() }
}

export class TokenFileError extends Error {}
