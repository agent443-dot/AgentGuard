import { describeStdin, tilde, type Stdin } from './env.js'

/** One child process: an argv array, never a shell line, so no value is ever parsed by a shell. */
export interface Command {
  cmd: string
  args: string[]
  cwd?: string
  stdin?: Stdin
  /** Return stdout instead of showing it. */
  capture?: boolean
}

/** A command the state file marks done once it succeeds, so a rerun skips it. */
export interface Task {
  id: string
  command: Command
}

const plain = /^[\w@%+=:,./~-]+$/

function quote(arg: string): string {
  return plain.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`
}

/** The command as a person would type it, with each stdin value shown as where it comes from. */
export function render(command: Command, home: string): string[] {
  const line = [command.cmd, ...command.args].map((arg) => quote(tilde(arg, home))).join(' ')
  const where = command.cwd === undefined ? '' : `   (in ${tilde(command.cwd, home)})`
  const lines = [`$ ${line}${where}`]
  if (command.stdin !== undefined) {
    const [first, ...rest] = describeStdin(command.stdin, home)
    lines.push(`    stdin: ${first}`, ...rest.map((entry) => `           ${entry}`))
  }
  return lines
}
