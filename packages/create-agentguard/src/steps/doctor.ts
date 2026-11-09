import type { DoctorCheck } from '@agentguard/shared'
import { appNames } from '../domain/answers.js'
import {
  chainsResponse,
  doctorResponse,
  failed,
  fallbackChecks,
  printChecks,
} from '../domain/doctor.js'
import { WizardError } from '../domain/errors.js'
import { pathsFor, PROXY_PORT, proxyCommand, SECRETS } from '../domain/plan.js'
import { prefixesIn } from '../domain/state.js'
import { readSecret, type Ctx } from './context.js'

export const ADMIN_BASE = `http://127.0.0.1:${PROXY_PORT}`
const HEALTH_WAIT_MS = 30_000

/**
 * Runs `fn` with `fly proxy` up, and always stops it. `healthy` says whether guard-core answered
 * /health through it in time.
 */
export async function withProxy<T>(
  ctx: Ctx,
  guardApp: string,
  fn: (healthy: boolean) => Promise<T>,
): Promise<T> {
  const proxy = await ctx.run.start(proxyCommand(guardApp))
  try {
    return await fn(ctx.dry || (await healthy(ctx)))
  } finally {
    await proxy.stop()
  }
}

async function healthy(ctx: Ctx): Promise<boolean> {
  const deadline = ctx.now() + HEALTH_WAIT_MS
  while (ctx.now() < deadline) {
    try {
      if ((await ctx.http.request('GET', `${ADMIN_BASE}/health`)).status === 200) {
        return true
      }
    } catch {
      // The proxy is still connecting.
    }
    await ctx.sleep(1_000)
  }
  return false
}

export async function checks(ctx: Ctx, token: string, guardApp: string): Promise<DoctorCheck[]> {
  const response = await ctx.http.request('GET', `${ADMIN_BASE}/v1/admin/doctor`, { token })
  if (response.status === 200) {
    const parsed = doctorResponse.safeParse(response.json)
    if (!parsed.success) {
      throw new WizardError('ADMIN_API', 'guard-core sent a doctor report this wizard cannot read')
    }
    return parsed.data.checks
  }
  if (response.status !== 404) {
    throw new WizardError('ADMIN_API', `guard-core answered ${response.status} to the doctor`)
  }
  ctx.say('(this guard-core has no doctor yet: the checks below come from its health and chains)')
  const chains = await ctx.http.request('GET', `${ADMIN_BASE}/v1/admin/chains`, { token })
  const parsed = chains.status === 200 ? chainsResponse.safeParse(chains.json) : undefined
  return fallbackChecks(guardApp, true, parsed?.success ? parsed.data : null)
}

/** Prints the checks and says whether any failed. */
export async function report(ctx: Ctx, token: string, guardApp: string, healthy: boolean) {
  if (ctx.dry) {
    ctx.say(`  → GET ${ADMIN_BASE}/v1/admin/doctor, or /health and /v1/admin/chains if it is 404`)
    return false
  }
  const list = healthy ? await checks(ctx, token, guardApp) : fallbackChecks(guardApp, false, null)
  printChecks(list).forEach((line) => ctx.say(line))
  return failed(list)
}

/** `create-agentguard doctor`. Returns the exit code. */
export async function doctor(ctx: Ctx, prefix?: string): Promise<number> {
  const chosen = prefix ?? (await onlySetup(ctx))
  const paths = pathsFor(ctx.home, ctx.cwd, chosen)
  const token = ctx.dry ? '' : await readSecret(ctx, paths, SECRETS.admin)
  const guard = appNames(chosen).guard
  const bad = await withProxy(ctx, guard, (healthy) => report(ctx, token, guard, healthy))
  return bad ? 1 : 0
}

async function onlySetup(ctx: Ctx): Promise<string> {
  const found = prefixesIn(await ctx.files.list(`${ctx.home}/.agentguard`))
  if (found.length === 1 && found[0] !== undefined) {
    return found[0]
  }
  throw new WizardError(
    'NOT_SET_UP',
    found.length === 0
      ? 'no setup in ~/.agentguard: run create-agentguard first'
      : `several setups in ~/.agentguard: pass --prefix with one of ${found.join(', ')}`,
  )
}
