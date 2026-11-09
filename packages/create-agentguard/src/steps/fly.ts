import { appNames } from '../domain/answers.js'
import { rewriteFlyToml, type FlyTomlChanges } from '../domain/flytoml.js'
import { flyTasks, flyToml, type Setup } from '../domain/plan.js'
import type { State } from '../domain/state.js'
import { heading, runTasks, type Ctx } from './context.js'

export async function flyApps(ctx: Ctx, setup: Setup, state: State): Promise<void> {
  heading(ctx, 4, 'Fly.io: the two apps, the database volume and the secrets')
  const { prefix, region } = setup.answers
  const apps = appNames(prefix)
  await ctx.files.ensureDir(setup.paths.flyDir)
  await writeConfig(ctx, setup, 'guard-core', {
    app: apps.guard,
    region,
    peer: { name: 'BOT_URL', app: apps.bot },
  })
  await writeConfig(ctx, setup, 'telegram-bot', {
    app: apps.bot,
    region,
    peer: { name: 'GUARD_URL', app: apps.guard },
  })
  await runTasks(ctx, state, setup.paths, flyTasks(setup))
  ctx.say('Nothing is deployed yet: that waits for your vaults, so each app starts complete.')
}

/** Written on every run, from the checkout's current fly.toml. */
async function writeConfig(ctx: Ctx, setup: Setup, pkg: string, changes: FlyTomlChanges) {
  const source = `${setup.paths.repo}/packages/${pkg}/fly.toml`
  const target = flyToml(setup.paths, changes.app)
  if (ctx.dry && !(await ctx.files.exists(source))) {
    await ctx.files.write(target, '')
    return
  }
  await ctx.files.write(target, rewriteFlyToml(await ctx.files.read(source), changes))
}
