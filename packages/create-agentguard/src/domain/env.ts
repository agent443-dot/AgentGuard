import { WizardError } from './errors.js'

/**
 * Where a value fed to a command comes from. The plan holds only these references, never a secret:
 * a secret is read from its file at the moment it is written to the child's stdin, so a printed or
 * logged plan cannot leak one.
 */
export type Source =
  | { value: string }
  /** A key of the wizard's env file. */
  | { secret: string; from: string }
  /** A whole file, such as a hot key, with its whitespace removed. */
  | { file: string }

export type Stdin = { env: [string, Source][] } | { raw: Source }

const NAME = /^[A-Z][A-Z0-9_]*$/

/** How a value shows in a dry run or a printed command: public values as they are. */
export function describe(source: Source, home: string): string {
  if ('value' in source) {
    return source.value
  }
  return `<from ${tilde('secret' in source ? source.from : source.file, home)}>`
}

export function tilde(path: string, home: string): string {
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
}

export function describeStdin(stdin: Stdin, home: string): string[] {
  if ('raw' in stdin) {
    return [describe(stdin.raw, home)]
  }
  return stdin.env.map(([name, source]) => `${name}=${describe(source, home)}`)
}

/**
 * The text written to the child's stdin: KEY=VALUE lines, as `fly secrets import` reads them, or a
 * bare value, as `vercel env add` does. Errors name the variable, never its value.
 */
export function stdinText(stdin: Stdin, read: (source: Source) => string): string {
  if ('raw' in stdin) {
    return checked('value', read(stdin.raw))
  }
  return stdin.env
    .map(([name, source]) => {
      if (!NAME.test(name)) {
        throw new WizardError('INVALID_INPUT', `${name} is not a variable name`)
      }
      return `${name}=${checked(name, read(source))}\n`
    })
    .join('')
}

function checked(name: string, value: string): string {
  if (value === '') {
    throw new WizardError('INVALID_INPUT', `${name} would be empty`)
  }
  if (/[\r\n]/.test(value)) {
    throw new WizardError('INVALID_INPUT', `${name} spans more than one line`)
  }
  return value
}

/** The wizard's own env file: KEY=VALUE lines it wrote itself, so no quoting or expansion. */
export function parseEnvFile(text: string): Record<string, string> {
  const entries: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const at = line.indexOf('=')
    const name = line.slice(0, at).trim()
    if (at > 0 && NAME.test(name)) {
      entries[name] = line.slice(at + 1).trim()
    }
  }
  return entries
}

export function formatEnvFile(entries: Record<string, string>): string {
  const lines = Object.entries(entries).map(([name, value]) => `${name}=${checked(name, value)}`)
  return `# Written by create-agentguard. Secrets: keep this file 0600 and never commit it.\n${lines.join('\n')}\n`
}

/** A file's contents as one value: a keypair JSON array or a 0x key, without its newline. */
export function compact(contents: string): string {
  return contents.replace(/\s+/g, '')
}
