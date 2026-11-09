import { pageOrigin } from '../domain/address.js'
import { appNames } from '../domain/answers.js'
import { WizardError } from '../domain/errors.js'
import { pageTasks, type Setup } from '../domain/plan.js'
import type { State } from '../domain/state.js'
import { heading, runTasks, saveState, type Ctx } from './context.js'

export async function signingPage(ctx: Ctx, setup: Setup, state: State): Promise<void> {
  heading(ctx, 5, 'Your signing page on Vercel')
  ctx.say(
    'Phantom signs your vault setup and its kill on this page. Your hot wallets are built in.',
  )
  await runTasks(ctx, state, setup.paths, pageTasks(setup))
  if (state.pageUrl === undefined) {
    const fallback = `https://${appNames(setup.answers.prefix).page}.vercel.app`
    state.pageUrl = ctx.dry
      ? fallback
      : await ctx.prompt.ask({
          text: "Your page's production address, as Vercel printed it.",
          default: fallback,
          parse: pageOrigin,
        })
    await saveState(ctx, setup.paths, state)
  }
  setup.pageUrl = state.pageUrl
  await verify(ctx, setup, state, state.pageUrl)
}

/** As docs/self-host.md step 3: the built page must name each hot wallet, or it is not yours. */
async function verify(ctx: Ctx, setup: Setup, state: State, page: string): Promise<void> {
  const addresses = setup.answers.networks.map((network) => setup.hot[network] ?? '')
  const url = `${page}/app.js`
  if (state.done.includes('page:verified')) {
    return
  }
  if (ctx.dry) {
    ctx.say(`  would fetch ${url} and check that it names ${addresses.join(' and ')}`)
    return
  }
  const response = await ctx.http.request('GET', url)
  const missing = addresses.filter((address) => !response.text.includes(address))
  if (response.status !== 200 || missing.length > 0) {
    // So the rerun deploys the page again and asks for its address again.
    state.done = state.done.filter((id) => !id.startsWith('vercel:'))
    delete state.pageUrl
    await saveState(ctx, setup.paths, state)
    throw new WizardError(
      'PAGE_MISMATCH',
      response.status === 200
        ? `${url} does not name the hot wallet ${missing.join(', ')}. Check the page's environment variables in Vercel, then run create-agentguard again.`
        : `${url} answered ${response.status}. Check the address, then run create-agentguard again.`,
    )
  }
  ctx.say('✓ The page names your hot wallets')
  state.done.push('page:verified')
  await saveState(ctx, setup.paths, state)
}
