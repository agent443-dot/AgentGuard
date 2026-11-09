import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Launch } from './clients.js'

/**
 * How a client should start the server that is running `setup` now: this checkout's own entry
 * point, with absolute paths because clients start it from anywhere. Never a package fetched by
 * name, which whoever holds that name on npm would control.
 */
export function launchCommand(entryUrl: string): Launch {
  const entry = fileURLToPath(entryUrl)
  if (!entry.endsWith('.ts')) {
    return { command: 'node', args: [entry] }
  }
  const pkg = dirname(dirname(entry))
  return { command: join(pkg, 'node_modules', '.bin', 'tsx'), args: [entry] }
}
