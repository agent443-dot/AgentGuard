import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Launch } from './clients.js'

/**
 * How a client should start the server that is running `setup` now. From a checkout that is this
 * package's own tsx and entry point, with absolute paths because clients start it from anywhere;
 * from the published package it is npx.
 */
export function launchCommand(entryUrl: string): Launch {
  if (!entryUrl.endsWith('.ts')) {
    return { command: 'npx', args: ['-y', '@agentguard/mcp-server'] }
  }
  const entry = fileURLToPath(entryUrl)
  const pkg = dirname(dirname(entry))
  return { command: join(pkg, 'node_modules', '.bin', 'tsx'), args: [entry] }
}
