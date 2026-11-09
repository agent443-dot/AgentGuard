import { CHAINS } from '@agentguard/shared'
import { describe, expect, it } from 'vitest'
import { pageOrigin, vaultAddress } from '../src/domain/address.js'
import { formatUsd, toBaseUnits } from '../src/domain/amount.js'
import {
  appNames,
  capSchema,
  check,
  defaultPrefix,
  familiesSchema,
  httpsUrlSchema,
  ownerIdsSchema,
  prefixSchema,
  telegramTokenSchema,
  yesNo,
  type Answers,
} from '../src/domain/answers.js'
import { parseArgs } from '../src/domain/args.js'
import { fundingLines } from '../src/domain/fund.js'
import { capLink, createLink } from '../src/domain/links.js'
import { labelOf, networkFor } from '../src/domain/networks.js'
import { pathsFor } from '../src/domain/plan.js'
import { presetPolicy, tokenFromScript } from '../src/domain/policy.js'
import { emptyState, prefixesIn, stateSchema } from '../src/domain/state.js'
import { HOME, MULTISIG, REPO, RH_HOT, SAFE, SOL_HOT } from './fakes.js'

const answers: Answers = {
  prefix: 'acme',
  org: 'personal',
  region: 'gru',
  networks: ['solana-mainnet', 'robinhood-mainnet'],
  caps: { 'solana-mainnet': '20000000', 'robinhood-mainnet': '3000000' },
  preset: 'careful',
  ownerIds: '111',
  agentId: 'agent-1',
}

describe('amounts', () => {
  it('converts dollars to base units in bigint and back', () => {
    expect(toBaseUnits('20')).toBe(20_000_000n)
    expect(toBaseUnits('0.5')).toBe(500_000n)
    expect(toBaseUnits(' 1.000001 ')).toBe(1_000_001n)
    expect(formatUsd(500_000n)).toBe('0.5')
    expect(formatUsd(20_000_000n)).toBe('20')
  })

  it('refuses what is not a plain dollar amount, never rounding', () => {
    for (const bad of ['', '-1', '1e3', '0.0000001', '01', '1.', 'abc']) {
      expect(() => toBaseUnits(bad)).toThrow(/not an amount/)
    }
  })
})

describe('answers', () => {
  it('validates Fly names, ids, tokens and URLs', () => {
    expect(check(prefixSchema, 'acme-1')).toBe('acme-1')
    for (const bad of ['a', 'Acme', '1acme', 'acme-', 'ac--me', 'x'.repeat(31)]) {
      expect(() => check(prefixSchema, bad)).toThrow()
    }
    expect(check(ownerIdsSchema, '111, 222')).toBe('111,222')
    expect(() => check(ownerIdsSchema, '111,abc')).toThrow(/positive number/)
    expect(() => check(ownerIdsSchema, '99999999999999999')).toThrow(/too large/)
    expect(check(telegramTokenSchema, '123:ab-C_d')).toBe('123:ab-C_d')
    expect(() => check(telegramTokenSchema, 'nope')).toThrow(/BotFather/)
    expect(() => check(httpsUrlSchema, 'http://rpc')).toThrow(/https/)
    expect(() => check(httpsUrlSchema, 'not a url')).toThrow(/https/)
  })

  it('takes a cap above 0 and at most 50, as base units', () => {
    expect(check(capSchema, '50')).toBe('50000000')
    expect(check(capSchema, '0.25')).toBe('250000')
    expect(() => check(capSchema, '50.01')).toThrow(/at most 50/)
    expect(() => check(capSchema, '0')).toThrow(/above 0/)
    expect(() => check(capSchema, 'ten')).toThrow(/dollars/)
  })

  it('reads chains and yes or no', () => {
    expect(check(familiesSchema, 'Both')).toEqual(['solana', 'robinhood'])
    expect(check(familiesSchema, 'robinhood')).toEqual(['robinhood'])
    expect(() => check(familiesSchema, 'base')).toThrow()
    expect(yesNo('', true)).toBe(true)
    expect(yesNo('No', true)).toBe(false)
    expect(yesNo('y', false)).toBe(true)
    expect(() => yesNo('maybe', true)).toThrow(/yes or no/)
  })

  it('derives a valid prefix from the OS user', () => {
    expect(defaultPrefix('Maria.Silva')).toBe('maria-silva')
    expect(defaultPrefix('42')).toBe('agentguard')
    expect(defaultPrefix('_x')).toBe('agentguard')
    expect(appNames('acme')).toEqual({
      guard: 'acme-guard-core',
      bot: 'acme-bot',
      page: 'acme-signing-page',
    })
  })
})

describe('addresses', () => {
  it('takes a base58 multisig and a checksummed Safe', () => {
    expect(vaultAddress('solana-mainnet', ` ${MULTISIG} `)).toBe(MULTISIG)
    expect(() => vaultAddress('solana-mainnet', '0OIl'.repeat(10))).toThrow(/base58/)
    expect(vaultAddress('robinhood-mainnet', SAFE)).toBe(SAFE)
    expect(vaultAddress('robinhood-mainnet', '0x52908400098527886e0f7030069857d2e4169ee7')).toBe(
      '0x52908400098527886E0F7030069857D2E4169EE7',
    )
    // A wrong checksum is a typo.
    expect(() =>
      vaultAddress('robinhood-testnet', '0x52908400098527886E0F7030069857D2E4169Ee7'),
    ).toThrow(/Safe address/)
    expect(() => vaultAddress('robinhood-mainnet', MULTISIG)).toThrow(/Safe address/)
  })

  it('takes the page as an https origin only', () => {
    expect(pageOrigin('https://acme.vercel.app/')).toBe('https://acme.vercel.app')
    for (const bad of ['http://acme.vercel.app', 'https://a.app/x', 'https://a.app/?q=1', 'nope']) {
      expect(() => pageOrigin(bad)).toThrow()
    }
  })
})

describe('links', () => {
  const page = 'https://acme.vercel.app'
  it("builds the page's create and cap links with the cap in base units", () => {
    expect(createLink(page, 'solana-mainnet')).toBe(`${page}/?action=create&cluster=mainnet-beta`)
    expect(createLink(page, 'robinhood-mainnet')).toBe(`${page}/?action=create&cluster=robinhood`)
    expect(capLink(page, 'solana-mainnet', MULTISIG, 20_000_000n)).toBe(
      `${page}/?action=add-limit&cluster=mainnet-beta&multisig=${MULTISIG}&amount=20000000`,
    )
    expect(capLink(page, 'robinhood-testnet', SAFE, 5_000_000n)).toBe(
      `${page}/?action=enable&cluster=robinhood-testnet&safe=${SAFE}&amount=5000000`,
    )
  })
})

describe('presetPolicy', () => {
  it('is the preset in shadow mode, allowing no domain or recipient yet', () => {
    expect(
      presetPolicy({
        ...answers,
        preset: 'standard',
        caps: { 'solana-mainnet': '50000000', 'robinhood-mainnet': '50000000' },
      }),
    ).toEqual({
      chains: [CHAINS.solanaMainnet, CHAINS.robinhood],
      tokens: [
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
      ],
      perTxMax: '5000000',
      dailyMax: '20000000',
      approvalThreshold: '1000000',
      allowedRecipients: [],
      allowedDomains: [],
      paused: false,
      mode: 'shadow',
    })
  })

  it('keeps the day within the smallest onchain cap', () => {
    const policy = presetPolicy({
      ...answers,
      caps: { ...answers.caps, 'robinhood-mainnet': '500000' },
    })
    expect(policy.dailyMax).toBe('500000')
    expect(policy.perTxMax).toBe('500000')
    expect(policy.approvalThreshold).toBe('500000')
  })

  it('reads the token create-agent.ts prints on its last line', () => {
    const token = 'ab'.repeat(32)
    expect(tokenFromScript(`agent a created. Token, shown once:\n${token}\n`)).toBe(token)
    expect(tokenFromScript('Error: exists')).toBeUndefined()
  })
})

describe('funding, networks, args and state', () => {
  it('says what to send each hot wallet and vault', () => {
    const lines = fundingLines({
      answers,
      paths: pathsFor(HOME, REPO, 'acme'),
      hot: { 'solana-mainnet': SOL_HOT, 'robinhood-mainnet': RH_HOT },
      vaults: { 'solana-mainnet': MULTISIG, 'robinhood-mainnet': SAFE },
    }).join('\n')
    expect(lines).toContain(`about 0.02 SOL to the hot wallet ${SOL_HOT}`)
    expect(lines).toContain(`about 0.002 ETH to the hot wallet ${RH_HOT}`)
    expect(lines).toContain(`not the multisig ${MULTISIG}`)
    expect(lines).toContain('0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168')
    expect(lines).toContain('3 USDG cap')
  })

  it('maps chains to networks and labels', () => {
    expect(networkFor('solana', true)).toBe('solana-devnet')
    expect(networkFor('robinhood', false)).toBe('robinhood-mainnet')
    expect(networkFor('robinhood', true)).toBe('robinhood-testnet')
    expect(labelOf(CHAINS.robinhood)).toBe('Robinhood Chain')
    expect(labelOf('eip155:1')).toBe('eip155:1')
  })

  it('parses the command line', () => {
    expect(parseArgs([])).toEqual({ command: 'setup', dryRun: false })
    expect(parseArgs(['doctor', '--prefix', 'acme'])).toEqual({
      command: 'doctor',
      dryRun: false,
      prefix: 'acme',
    })
    expect(parseArgs(['--dry-run']).dryRun).toBe(true)
    expect(parseArgs(['-h']).command).toBe('help')
    expect(() => parseArgs(['--prefix'])).toThrow()
    expect(() => parseArgs(['--prefix', 'Bad!'])).toThrow()
    expect(() => parseArgs(['deploy'])).toThrow(/unknown argument deploy/)
  })

  it('keeps public progress and finds the setups in ~/.agentguard', () => {
    expect(stateSchema.parse({ version: 1 })).toEqual(emptyState())
    expect(
      prefixesIn(['acme.state.json', 'acme.env', 'x.state.json.bak', 'b-2.state.json']),
    ).toEqual(['acme', 'b-2'])
  })
})
