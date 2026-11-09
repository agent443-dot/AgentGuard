import { appNames } from '../domain/answers.js'
import { WizardError } from '../domain/errors.js'
import { fundingLines } from '../domain/fund.js'
import { tilde } from '../domain/env.js'
import {
  agentTokenFile,
  dockerignoreGuard,
  finishTasks,
  SECRETS,
  type Setup,
} from '../domain/plan.js'
import type { State } from '../domain/state.js'
import { firstAgent } from './agent.js'
import { heading, readSecret, runTasks, type Ctx } from './context.js'
import { report, withProxy } from './doctor.js'

export function fund(ctx: Ctx, setup: Setup): void {
  heading(ctx, 7, 'Fund your wallets')
  fundingLines(setup).forEach((line) => ctx.say(line))
}

export async function finish(ctx: Ctx, setup: Setup, state: State): Promise<void> {
  heading(ctx, 8, 'Deploy, and your first agent')
  try {
    await ctx.run.run(dockerignoreGuard(setup))
  } catch (error) {
    if (error instanceof WizardError) {
      throw new WizardError('PREREQUISITE', 'STOP: the root .dockerignore must exclude **/.env')
    }
    throw error
  }
  await runTasks(ctx, state, setup.paths, finishTasks(setup))
  const guard = appNames(setup.answers.prefix).guard
  const token = ctx.dry ? '' : await readSecret(ctx, setup.paths, SECRETS.admin)
  await withProxy(ctx, guard, async (healthy) => {
    if (!healthy) {
      throw new WizardError(
        'ADMIN_API',
        `guard-core did not answer through fly proxy. Read its log with fly logs --app ${guard} --no-tail, then run create-agentguard again.`,
      )
    }
    await firstAgent(ctx, setup, state, token)
    ctx.say()
    ctx.say('Doctor:')
    await report(ctx, token, guard, healthy)
  })
  ctx.say()
  const tokenFile = agentTokenFile(setup.paths, setup.answers.prefix, setup.answers.agentId)
  ctx.say('Done. Connect your agent with one line. It asks for the agent token, which is in')
  ctx.say(`${tilde(tokenFile, ctx.home)}:`)
  ctx.say('  npx @agentguard/mcp-server setup claude-code')
  ctx.say('Later, `create-agentguard doctor` checks everything again.')
}
