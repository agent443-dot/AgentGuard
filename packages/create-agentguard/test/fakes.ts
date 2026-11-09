import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Files } from '../src/adapters/files.js'
import type { Http, HttpResponse } from '../src/adapters/http.js'
import type { KeyMaker } from '../src/adapters/keys.js'
import type { Prompter, Question } from '../src/adapters/prompt.js'
import { stdinFor, type Runner } from '../src/adapters/runner.js'
import { sourceReader } from '../src/adapters/sources.js'
import type { VaultReader } from '../src/adapters/vault.js'
import type { Command } from '../src/domain/command.js'
import { WizardError } from '../src/domain/errors.js'
import type { Ctx } from '../src/steps/context.js'

export const HOME = '/home/owner'
export const REPO = '/home/owner/AgentGuard'
export const SOL_HOT = 'H5fcEu5KvTqCDbxRnmGcAhTaWwT2kYEtFRgu3ZcXSmTq'
export const RH_HOT = '0x1111111111111111111111111111111111111111'
export const MULTISIG = 'Fm8bZNgwyhmzBpBq4GPZ1sr3x5mmGTkcTDRDc6EvSdJz'
export const SAFE = '0x2222222222222222222222222222222222222222'

const root = fileURLToPath(new URL('../../..', import.meta.url))
export const repoFile = (path: string) => readFileSync(`${root}/${path}`, 'utf8')

export interface MemoryFile {
  contents: string
  mode: number
}

export function memoryFiles(seed: Record<string, string> = {}) {
  const files = new Map<string, MemoryFile>(
    Object.entries(seed).map(([path, contents]) => [path, { contents, mode: 0o644 }]),
  )
  const dirs = new Map<string, number>()
  const api: Files = {
    exists: async (path) => files.has(path) || dirs.has(path),
    async read(path) {
      const file = files.get(path)
      if (file === undefined) {
        throw Object.assign(new Error(`ENOENT ${path}`), { code: 'ENOENT' })
      }
      return file.contents
    },
    list: async (dir) =>
      [...files.keys()]
        .filter((path) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes('/'))
        .map((path) => path.slice(dir.length + 1)),
    ensureDir: async (dir) => void dirs.set(dir, 0o700),
    async write(path, contents, options = {}) {
      if (options.create && files.has(path)) {
        throw new WizardError('KEY_EXISTS', `${path} already exists`)
      }
      files.set(path, { contents, mode: 0o600 })
    },
  }
  return { api, files, dirs }
}

/** Answers questions in order; an answer the question refuses is reported, like the terminal. */
export function scriptedPrompter(answers: string[]) {
  const asked: Question<unknown>[] = []
  const refused: string[] = []
  const prompter: Prompter = {
    async ask<T>(question: Question<T>): Promise<T> {
      asked.push(question as Question<unknown>)
      for (;;) {
        const raw = answers.shift()
        if (raw === undefined) {
          throw new Error(`no scripted answer for: ${question.text}`)
        }
        try {
          return question.parse(raw === '' ? (question.default ?? '') : raw)
        } catch (error) {
          if (!(error instanceof WizardError)) {
            throw error
          }
          refused.push(error.message)
        }
      }
    },
    close() {},
  }
  return { prompter, asked, refused }
}

export interface Ran {
  command: Command
  stdin?: string
}

/** Records each command with the stdin it would get. `fail` makes matching commands exit non-zero. */
export function fakeRunner(files: Files, outputs: (command: Command) => string = () => '') {
  const ran: Ran[] = []
  const started: Command[] = []
  let stopped = 0
  const runner: Runner = {
    async run(command) {
      const stdin =
        command.stdin === undefined ? undefined : await stdinFor(command.stdin, sourceReader(files))
      ran.push({ command, ...(stdin === undefined ? {} : { stdin }) })
      return outputs(command)
    },
    async start(command) {
      started.push(command)
      return { stop: async () => void stopped++ }
    },
  }
  return { runner, ran, started, stopped: () => stopped }
}

export type Route = (method: string, url: string, body: unknown) => Partial<HttpResponse>

export function fakeHttp(route: Route) {
  const calls: { method: string; url: string; token?: string; body?: unknown }[] = []
  const http: Http = {
    async request(method, url, options = {}) {
      calls.push({ method, url, ...options })
      const response = route(method, url, options.body)
      return { status: 200, text: '', json: undefined, ...response }
    },
  }
  return { http, calls }
}

export const fakeKeys: KeyMaker = {
  generate: (family) =>
    family === 'solana'
      ? { contents: `[${Array(64).fill(7).join(',')}]\n`, address: SOL_HOT }
      : { contents: `0x${'ab'.repeat(32)}\n`, address: RH_HOT },
  address: (family) => (family === 'solana' ? SOL_HOT : RH_HOT),
}

export function fakeVault(cap: (network: string) => bigint | null): VaultReader {
  return { cap: async (network) => cap(network) }
}

export function makeCtx(parts: Partial<Ctx> & Pick<Ctx, 'run' | 'prompt' | 'files'>) {
  const out: string[] = []
  let clock = 0
  const ctx: Ctx = {
    dry: false,
    home: HOME,
    cwd: REPO,
    username: 'Owner',
    nodeVersion: '22.1.0',
    http: fakeHttp(() => ({ status: 404 })).http,
    vault: fakeVault(() => null),
    keys: fakeKeys,
    say: (line = '') => void out.push(line),
    sleep: async (ms) => void (clock += ms),
    now: () => clock,
    token: () => 'f'.repeat(64),
    ...parts,
  }
  return { ctx, out }
}

/** The checkout's markers and fly.toml files, as the wizard looks for them. */
export function checkoutSeed(): Record<string, string> {
  return {
    [`${REPO}/.dockerignore`]: repoFile('.dockerignore'),
    [`${REPO}/packages/guard-core/fly.toml`]: repoFile('packages/guard-core/fly.toml'),
    [`${REPO}/packages/telegram-bot/fly.toml`]: repoFile('packages/telegram-bot/fly.toml'),
    [`${REPO}/packages/onchain/web/vercel.json`]: repoFile('packages/onchain/web/vercel.json'),
  }
}
