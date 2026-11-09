import { dirname } from 'node:path'
import { yesNo } from '../domain/answers.js'
import type { Command } from '../domain/command.js'
import { WizardError } from '../domain/errors.js'
import { cloneCommand } from '../domain/plan.js'
import { heading, type Ctx } from './context.js'

const MARKERS = [
  '.dockerignore',
  'packages/guard-core/fly.toml',
  'packages/telegram-bot/fly.toml',
  'packages/onchain/web/vercel.json',
]

const vercel = (...args: string[]): Command => ({ cmd: 'npx', args: ['--yes', 'vercel', ...args] })

/** Checks the tools and logins, and returns the AgentGuard checkout every command runs in. */
export async function prerequisites(ctx: Ctx): Promise<string> {
  heading(ctx, 1, 'What you need')
  const major = Number(ctx.nodeVersion.split('.')[0])
  if (!(major >= 20)) {
    throw new WizardError(
      'PREREQUISITE',
      `Node 20 or newer is needed, and this is Node ${ctx.nodeVersion}: https://nodejs.org`,
    )
  }
  await need(ctx, { cmd: 'git', args: ['--version'] }, 'git is needed: https://git-scm.com')
  await need(
    ctx,
    { cmd: 'fly', args: ['version'] },
    'flyctl is needed: curl -L https://fly.io/install.sh | sh',
  )
  await loggedIn(
    ctx,
    'Fly.io',
    { cmd: 'fly', args: ['auth', 'whoami'] },
    {
      cmd: 'fly',
      args: ['auth', 'login'],
    },
  )
  await loggedIn(ctx, 'Vercel', vercel('whoami'), vercel('login'))
  return checkout(ctx)
}

async function need(ctx: Ctx, command: Command, hint: string): Promise<void> {
  try {
    await ctx.run.run({ ...command, capture: true })
  } catch (error) {
    if (error instanceof WizardError) {
      throw new WizardError('PREREQUISITE', hint)
    }
    throw error
  }
}

async function loggedIn(ctx: Ctx, service: string, whoami: Command, login: Command) {
  const who = () => ctx.run.run({ ...whoami, capture: true })
  let account: string
  try {
    account = await who()
  } catch (error) {
    if (!(error instanceof WizardError)) {
      throw error
    }
    const now = await ctx.prompt.ask({
      text: `You are not logged in to ${service}. Log in now? It opens your browser.`,
      default: 'yes',
      parse: (raw) => yesNo(raw, true),
    })
    if (!now) {
      throw new WizardError(
        'PREREQUISITE',
        `log in to ${service}, then run create-agentguard again`,
      )
    }
    await ctx.run.run(login)
    account = await who()
  }
  ctx.say(`✓ ${service}${account.trim() === '' ? '' : `: ${account.trim().split('\n').pop()}`}`)
}

async function isCheckout(ctx: Ctx, dir: string): Promise<boolean> {
  for (const marker of MARKERS) {
    if (!(await ctx.files.exists(`${dir}/${marker}`))) {
      return false
    }
  }
  return true
}

/** This folder or one above it: `pnpm --filter` runs the wizard from its own package folder. */
async function enclosingCheckout(ctx: Ctx): Promise<string | undefined> {
  for (let dir = ctx.cwd; ; dir = dirname(dir)) {
    if (await isCheckout(ctx, dir)) {
      return dir
    }
    if (dir === dirname(dir)) {
      return undefined
    }
  }
}

async function checkout(ctx: Ctx): Promise<string> {
  const here = await enclosingCheckout(ctx)
  if (here !== undefined) {
    return here
  }
  const target = `${ctx.home}/AgentGuard`
  if (await isCheckout(ctx, target)) {
    ctx.say('✓ Using the AgentGuard checkout in ~/AgentGuard')
    return target
  }
  const clone = await ctx.prompt.ask({
    text: 'This folder is not an AgentGuard checkout. Clone it into ~/AgentGuard and continue there?',
    default: 'yes',
    parse: (raw) => yesNo(raw, true),
  })
  if (!clone) {
    throw new WizardError('PREREQUISITE', 'run create-agentguard from an AgentGuard checkout')
  }
  await ctx.run.run(cloneCommand(target))
  return target
}
