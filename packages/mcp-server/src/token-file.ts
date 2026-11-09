import { readFileSync, statSync } from 'node:fs'

export interface TokenFileIo {
  read: (path: string) => string
  mode: (path: string) => number
  platform: NodeJS.Platform
}

const nodeIo: TokenFileIo = {
  read: (path) => readFileSync(path, 'utf8'),
  mode: (path) => statSync(path).mode,
  platform: process.platform,
}

/**
 * Lets a client config name a file instead of holding the agent token, so the token is in no
 * config, argv or shell history. AGENT_TOKEN, when set, wins. Like ssh with a private key, a file
 * that others can read is refused rather than used.
 */
export function withTokenFile(env: NodeJS.ProcessEnv, io: TokenFileIo = nodeIo): NodeJS.ProcessEnv {
  const path = env['AGENT_TOKEN_FILE']
  if (env['AGENT_TOKEN'] !== undefined || path === undefined || path === '') {
    return env
  }
  let token: string
  try {
    // Mode bits mean nothing on Windows; there the file's ACL is the user's to set.
    if (io.platform !== 'win32' && (io.mode(path) & 0o077) !== 0) {
      throw new TokenFileError(
        `AGENT_TOKEN_FILE ${path} is readable by others: run chmod 600 on it`,
      )
    }
    token = io.read(path).trim()
  } catch (error) {
    if (error instanceof TokenFileError) {
      throw error
    }
    throw new TokenFileError(`AGENT_TOKEN_FILE ${path} could not be read`)
  }
  return { ...env, AGENT_TOKEN: token }
}

export class TokenFileError extends Error {}
