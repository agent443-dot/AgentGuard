import { tilde } from '../domain/env.js'
import { pathsFor, type Setup } from '../domain/plan.js'
import { askAnswers, choosePrefix, secrets } from './answers.js'
import { heading, loadState, saveState, type Ctx } from './context.js'
import { finish, fund } from './finish.js'
import { flyApps } from './fly.js'
import { hotKeys } from './keys.js'
import { signingPage } from './page.js'
import { prerequisites } from './prereqs.js'
import { vaults } from './vault.js'

/** The whole setup, in order. Each step records its progress, so a rerun continues where it stopped. */
export async function setup(ctx: Ctx, prefixArg?: string): Promise<void> {
  if (ctx.dry) {
    ctx.say('Dry run: nothing is run and nothing is written. Each command is printed instead.')
  }
  const repo = await prerequisites(ctx)
  heading(ctx, 2, 'Your answers')
  const prefix = prefixArg ?? (await choosePrefix(ctx))
  const paths = pathsFor(ctx.home, repo, prefix)
  const state = await loadState(ctx, paths)
  if (state.answers === undefined) {
    state.answers = await askAnswers(ctx, prefix)
  } else {
    ctx.say(`Continuing the setup in ${tilde(paths.stateFile, ctx.home)}.`)
  }
  await ctx.files.ensureDir(paths.dir)
  await secrets(ctx, paths, state.answers)
  await saveState(ctx, paths, state)

  // The same objects as in the state, so what a step learns is saved with it.
  const plan: Setup = { answers: state.answers, paths, hot: state.hot, vaults: state.vaults }
  await hotKeys(ctx, plan, state)
  await flyApps(ctx, plan, state)
  await signingPage(ctx, plan, state)
  await vaults(ctx, plan, state)
  fund(ctx, plan)
  await finish(ctx, plan, state)
}
