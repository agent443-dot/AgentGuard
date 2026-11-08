import { CHAINS } from '@agentguard/shared'
import { describe, expect, it } from 'vitest'
// The signing page's own helper: the bot's link must be the one the page would build for itself.
import { openInPhantom } from '../../onchain/web/src/wallet.js'
import { phantomKillUrl } from '../src/domain/phantom.js'

const MULTISIG = '3UUSmTssQT7xAnH7SKiStPyy1Tn2SUqUM53Ns7XnUcVu'
const HOT = 'AxCgDMb1uirKHyEsC3WUkWY8G7CYa1BE1YX4j5bFpita'
const ISSUED = new Date('2026-11-08T01:30:00.900Z')
const page = { signPage: 'https://sign.agentguard.example', multisig: MULTISIG, hot: HOT }

describe('phantomKillUrl', () => {
  it('builds the universal link exactly, with the kill link encoded inside it', () => {
    expect(phantomKillUrl({ ...page, chain: CHAINS.solanaDevnet }, ISSUED)).toBe(
      'https://phantom.app/ul/browse/' +
        'https%3A%2F%2Fsign.agentguard.example%2F%3Faction%3Dkill%26cluster%3Ddevnet' +
        `%26multisig%3D${MULTISIG}%26hot%3D${HOT}%26issued%3D1794101400` +
        '?ref=https%3A%2F%2Fsign.agentguard.example',
    )
  })

  it('takes the cluster from the chain: mainnet is mainnet-beta', () => {
    expect(phantomKillUrl({ ...page, chain: CHAINS.solanaMainnet }, ISSUED)).toContain(
      '%26cluster%3Dmainnet-beta%26',
    )
  })

  it('matches what the signing page builds for the same link', () => {
    const link = `https://sign.agentguard.example/?action=kill&cluster=devnet&multisig=${MULTISIG}&hot=${HOT}&issued=1794101400`
    expect(phantomKillUrl({ ...page, chain: CHAINS.solanaDevnet }, ISSUED)).toBe(
      openInPhantom(link),
    )
  })

  it('treats a trailing slash or a path on the page the same way', () => {
    const plain = phantomKillUrl({ ...page, chain: CHAINS.solanaDevnet }, ISSUED)
    expect(
      phantomKillUrl(
        { ...page, signPage: `${page.signPage}/`, chain: CHAINS.solanaDevnet },
        ISSUED,
      ),
    ).toBe(plain)
    expect(
      phantomKillUrl(
        { ...page, signPage: `${page.signPage}/sign`, chain: CHAINS.solanaDevnet },
        ISSUED,
      ),
    ).toContain('example%2Fsign%2F%3Faction%3Dkill')
  })

  it('stamps issued in whole unix seconds, as the signing page reads it', () => {
    const at = new Date('1970-01-01T00:00:59.999Z')
    expect(phantomKillUrl({ ...page, chain: CHAINS.solanaDevnet }, at)).toContain(
      '%26issued%3D59?ref=',
    )
  })

  it('refuses a chain the signing page has no cluster for', () => {
    expect(() => phantomKillUrl({ ...page, chain: CHAINS.baseSepolia }, ISSUED)).toThrow(
      'no signing-page',
    )
  })
})
