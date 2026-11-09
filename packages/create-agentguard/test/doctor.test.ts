import { CHAINS } from '@agentguard/shared'
import { describe, expect, it } from 'vitest'
import { failed, fallbackChecks, printChecks } from '../src/domain/doctor.js'
import { doctor } from '../src/steps/doctor.js'
import { fakeHttp, fakeRunner, HOME, makeCtx, memoryFiles, scriptedPrompter } from './fakes.js'

describe('printChecks', () => {
  it('shows each check with its icon and its fix', () => {
    const checks = [
      { id: 'db', status: 'ok' as const, message: 'The database is writable' },
      { id: 'gas', status: 'warn' as const, message: 'Low SOL', fix: 'send 0.02 SOL' },
      { id: 'bot', status: 'fail' as const, message: 'The bot is down', fix: 'fly logs' },
    ]
    expect(printChecks(checks)).toEqual([
      '✅ The database is writable',
      '⚠️  Low SOL',
      '   fix: send 0.02 SOL',
      '❌ The bot is down',
      '   fix: fly logs',
    ])
    expect(failed(checks)).toBe(true)
    expect(failed(checks.slice(0, 2))).toBe(false)
  })
})

describe('fallbackChecks', () => {
  it('fails when guard-core is down or lists nothing', () => {
    expect(fallbackChecks('g', false, null)).toEqual([
      expect.objectContaining({ status: 'fail', fix: 'read the log: fly logs --app g --no-tail' }),
    ])
    expect(fallbackChecks('g', true, null).map((check) => check.status)).toEqual(['ok', 'fail'])
    expect(fallbackChecks('g', true, { chains: [] })[1]?.message).toMatch(/No chain/)
  })

  it('reads each chain as the bot does', () => {
    const checks = fallbackChecks('g', true, {
      chains: [
        {
          chain: CHAINS.solanaMainnet,
          allowance: { status: 'active', cap: '20000000', spent: '1500000' },
        },
        { chain: CHAINS.robinhood, allowance: { status: 'none' } },
        { chain: 'eip155:1', allowance: null },
      ],
    })
    expect(checks.slice(1).map((check) => [check.status, check.message])).toEqual([
      ['ok', 'Solana: daily cap 20, 1.5 spent today'],
      ['warn', 'Robinhood Chain: no onchain limit (killed, or never added)'],
      ['fail', 'eip155:1: the onchain cap could not be read'],
    ])
  })
})

describe('create-agentguard doctor', () => {
  const token = 'a'.repeat(64)
  const seed = {
    [`${HOME}/.agentguard/acme.state.json`]: '{"version":1}',
    [`${HOME}/.agentguard/acme.env`]: `ADMIN_TOKEN=${token}\n`,
  }

  function run(route: Parameters<typeof fakeHttp>[0]) {
    const files = memoryFiles(seed).api
    const runner = fakeRunner(files)
    const http = fakeHttp(route)
    const { ctx, out } = makeCtx({
      files,
      run: runner.runner,
      prompt: scriptedPrompter([]).prompter,
      http: http.http,
    })
    return { ctx, out, runner, http }
  }

  it('calls the doctor through fly proxy with the admin token, and stops the proxy', async () => {
    const { ctx, out, runner, http } = run((_method, url) =>
      url.endsWith('/v1/admin/doctor')
        ? { json: { checks: [{ id: 'db', status: 'ok', message: 'The database is writable' }] } }
        : {},
    )
    expect(await doctor(ctx)).toBe(0)
    expect(runner.started[0]?.args).toEqual(['proxy', '18787:8787', '--app', 'acme-guard-core'])
    expect(runner.stopped()).toBe(1)
    expect(http.calls.at(-1)).toEqual({
      method: 'GET',
      url: 'http://127.0.0.1:18787/v1/admin/doctor',
      token,
    })
    expect(out).toContain('✅ The database is writable')
    expect(out.join('\n')).not.toContain(token)
  })

  it('falls back to /v1/admin/chains when the doctor route is 404', async () => {
    const { ctx, out } = run((_method, url) =>
      url.endsWith('/doctor')
        ? { status: 404 }
        : url.endsWith('/chains')
          ? { json: { chains: [{ chain: CHAINS.solanaMainnet, allowance: null }] } }
          : {},
    )
    expect(await doctor(ctx)).toBe(1)
    expect(out).toContain('❌ Solana: the onchain cap could not be read')
  })

  it('reports guard-core down when /health never answers', async () => {
    const { ctx, out, runner } = run(() => ({ status: 502 }))
    expect(await doctor(ctx, 'acme')).toBe(1)
    expect(out).toContain('❌ guard-core does not answer on its private address')
    expect(runner.stopped()).toBe(1)
  })

  it('asks which setup when there are several, and refuses an unreadable report', async () => {
    const files = memoryFiles({ ...seed, [`${HOME}/.agentguard/b.state.json`]: '{}' }).api
    const { ctx } = makeCtx({
      files,
      run: fakeRunner(files).runner,
      prompt: scriptedPrompter([]).prompter,
    })
    await expect(doctor(ctx)).rejects.toThrow(/--prefix with one of acme, b/)
    const bad = run((_method, url) => (url.endsWith('/doctor') ? { json: { checks: 'no' } } : {}))
    await expect(doctor(bad.ctx)).rejects.toThrow(/cannot read/)
  })
})
