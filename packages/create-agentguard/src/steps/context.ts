import type { Files } from '../adapters/files.js'
import type { Http } from '../adapters/http.js'
import type { KeyMaker } from '../adapters/keys.js'
import type { Prompter } from '../adapters/prompt.js'
import type { Runner } from '../adapters/runner.js'
import type { VaultReader } from '../adapters/vault.js'
import type { Task } from '../domain/command.js'
import { parseEnvFile, tilde } from '../domain/env.js'
import { WizardError } from '../domain/errors.js'
import type { Paths } from '../domain/plan.js'
import { emptyState, stateSchema, type State } from '../domain/state.js'

/** Everything a step touches outside itself, so tests and --dry-run swap each one. */
export interface Ctx {
  dry: boolean
  home: string
  cwd: string
  username: string
  nodeVersion: string
  run: Runner
  prompt: Prompter
  files: Files
  http: Http
  vault: VaultReader
  keys: KeyMaker
  say: (line?: string) => void
  sleep: (ms: number) => Promise<void>
  now: () => number
  /** 32 random bytes, hex: a new service token. */
  token: () => string
}

export function heading(ctx: Ctx, step: number, title: string): void {
  ctx.say()
  ctx.say(`── ${step}. ${title}`)
}

export async function loadState(ctx: Ctx, paths: Paths): Promise<State> {
  if (!(await ctx.files.exists(paths.stateFile))) {
    return emptyState()
  }
  let parsed: unknown
  try {
    // Checked by stateSchema on the next line.
    // eslint-disable-next-line no-restricted-properties
    parsed = JSON.parse(await ctx.files.read(paths.stateFile))
  } catch {
    parsed = undefined
  }
  const state = stateSchema.safeParse(parsed)
  if (!state.success) {
    throw new WizardError(
      'INVALID_INPUT',
      `${tilde(paths.stateFile, ctx.home)} is damaged. Move it away to start this setup over.`,
    )
  }
  return state.data
}

export async function saveState(ctx: Ctx, paths: Paths, state: State): Promise<void> {
  if (!ctx.dry) {
    await ctx.files.write(paths.stateFile, `${JSON.stringify(state, null, 2)}\n`)
  }
}

export async function readSecret(ctx: Ctx, paths: Paths, name: string): Promise<string> {
  const value = (await ctx.files.exists(paths.envFile))
    ? parseEnvFile(await ctx.files.read(paths.envFile))[name]
    : undefined
  if (value === undefined || value === '') {
    throw new WizardError('NOT_SET_UP', `${name} is missing from ${tilde(paths.envFile, ctx.home)}`)
  }
  return value
}

export async function runTasks(ctx: Ctx, state: State, paths: Paths, tasks: Task[]): Promise<void> {
  for (const task of tasks) {
    if (state.done.includes(task.id)) {
      ctx.say(`  · ${task.id}: done in an earlier run`)
      continue
    }
    await ctx.run.run(task.command)
    state.done.push(task.id)
    await saveState(ctx, paths, state)
  }
}
