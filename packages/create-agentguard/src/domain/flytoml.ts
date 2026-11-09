import { WizardError } from './errors.js'

export interface FlyTomlChanges {
  app: string
  region: string
  /** An env variable holding the other app's private URL, and that app's name. */
  peer: { name: 'BOT_URL' | 'GUARD_URL'; app: string }
}

/**
 * The package's own fly.toml with only the app, its region and the peer's private host changed, so
 * every other setting stays the one the package's maintainers ship. A line that is missing or
 * appears twice fails rather than being guessed at.
 */
export function rewriteFlyToml(source: string, changes: FlyTomlChanges): string {
  let text = replaceOnce(source, /^app = "[^"]*"$/m, `app = "${changes.app}"`, 'app')
  text = replaceOnce(
    text,
    /^primary_region = "[^"]*"$/m,
    `primary_region = "${changes.region}"`,
    'primary_region',
  )
  const { name, app } = changes.peer
  const line = new RegExp(`^(\\s*${name} = ")([^"]*)(")$`, 'm')
  const match = line.exec(text)
  if (match === null) {
    throw missing(name)
  }
  const url = new URL(match[2] ?? '')
  url.hostname = `${app}.internal`
  return replaceOnce(text, line, `$1${url.origin}$3`, name)
}

function replaceOnce(text: string, pattern: RegExp, replacement: string, name: string): string {
  const all = new RegExp(pattern.source, `${pattern.flags}g`)
  const count = [...text.matchAll(all)].length
  if (count !== 1) {
    throw missing(name)
  }
  return text.replace(pattern, replacement)
}

function missing(name: string): WizardError {
  return new WizardError(
    'INVALID_INPUT',
    `the package's fly.toml does not have exactly one ${name} line; update create-agentguard`,
  )
}
