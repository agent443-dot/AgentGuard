import { describe, expect, it } from 'vitest'
import { render } from '../src/domain/command.js'
import {
  compact,
  describe as describeSource,
  formatEnvFile,
  parseEnvFile,
  stdinText,
  type Source,
} from '../src/domain/env.js'
import { HOME } from './fakes.js'

const envFile = `${HOME}/.agentguard/acme.env`
const keyFile = `${HOME}/.agentguard/acme-solana-mainnet-hot.json`
const read = (source: Source) =>
  'value' in source ? source.value : 'secret' in source ? `s3cret-${source.secret}` : '[1,2,3]'

describe('stdinText', () => {
  it('builds KEY=VALUE lines from each source', () => {
    const text = stdinText(
      {
        env: [
          ['ADMIN_TOKEN', { secret: 'ADMIN_TOKEN', from: envFile }],
          ['SOLANA_CHAIN', { value: 'solana:x' }],
          ['SOLANA_HOT_WALLET_KEYPAIR_JSON', { file: keyFile }],
        ],
      },
      read,
    )
    expect(text).toBe(
      'ADMIN_TOKEN=s3cret-ADMIN_TOKEN\nSOLANA_CHAIN=solana:x\nSOLANA_HOT_WALLET_KEYPAIR_JSON=[1,2,3]\n',
    )
  })

  it('feeds a bare value for vercel env add', () => {
    expect(stdinText({ raw: { value: 'abc' } }, read)).toBe('abc')
  })

  it('refuses an empty value, a value on two lines and a bad name, naming only the variable', () => {
    expect(() => stdinText({ env: [['TOKEN', { value: '' }]] }, read)).toThrow(
      'TOKEN would be empty',
    )
    expect(() => stdinText({ env: [['TOKEN', { value: 'a\nB=1' }]] }, read)).toThrow(
      'TOKEN spans more than one line',
    )
    expect(() => stdinText({ env: [['bad name', { value: 'x' }]] }, read)).toThrow(/not a variable/)
    expect(() => stdinText({ env: [['TOKEN', { value: 'hunter2\r' }]] }, read)).toThrow(
      /^TOKEN spans more than one line$/,
    )
  })
})

describe('describe', () => {
  it('shows public values and names the file a secret comes from', () => {
    expect(describeSource({ value: 'solana:x' }, HOME)).toBe('solana:x')
    expect(describeSource({ secret: 'ADMIN_TOKEN', from: envFile }, HOME)).toBe(
      '<from ~/.agentguard/acme.env>',
    )
    expect(describeSource({ file: '/etc/key' }, HOME)).toBe('<from /etc/key>')
  })

  it('renders a command with its stdin, never a secret', () => {
    const lines = render(
      {
        cmd: 'fly',
        args: ['secrets', 'import', '--app', 'acme-guard-core', '--stage'],
        cwd: `${HOME}/AgentGuard`,
        stdin: {
          env: [
            ['ADMIN_TOKEN', { secret: 'ADMIN_TOKEN', from: envFile }],
            ['SOLANA_CHAIN', { value: 'solana:x' }],
          ],
        },
      },
      HOME,
    )
    expect(lines).toEqual([
      '$ fly secrets import --app acme-guard-core --stage   (in ~/AgentGuard)',
      '    stdin: ADMIN_TOKEN=<from ~/.agentguard/acme.env>',
      '           SOLANA_CHAIN=solana:x',
    ])
  })

  it('quotes an argument a shell would split', () => {
    expect(render({ cmd: 'fly', args: ['-C', "sh -c 'x'"] }, HOME)).toEqual([
      `$ fly -C 'sh -c '\\''x'\\'''`,
    ])
  })
})

describe('env file', () => {
  it('round-trips and skips comments and junk', () => {
    const text = formatEnvFile({ ADMIN_TOKEN: 'abc', SOLANA_RPC_URL: 'https://x/?api-key=1=2' })
    expect(text.startsWith('# Written by create-agentguard')).toBe(true)
    expect(parseEnvFile(`${text}\nnot a line\n=x\n`)).toEqual({
      ADMIN_TOKEN: 'abc',
      SOLANA_RPC_URL: 'https://x/?api-key=1=2',
    })
  })

  it('compacts a key file to one value', () => {
    expect(compact('[1, 2,\n 3]\n')).toBe('[1,2,3]')
  })
})
