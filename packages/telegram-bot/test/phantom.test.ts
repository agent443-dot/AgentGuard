import { CHAINS } from '@agentguard/shared'
import { describe, expect, it } from 'vitest'
// The signing page's own helper: the bot's link must be the one the page would build for itself.
import { openInPhantom } from '../../onchain/web/src/wallet.js'
import { phantomKill, phantomKillUrl } from '../src/domain/phantom.js'

const PAGE = 'https://sign.agentguard.example'
const MULTISIG = '3UUSmTssQT7xAnH7SKiStPyy1Tn2SUqUM53Ns7XnUcVu'
const HOT = 'AxCgDMb1uirKHyEsC3WUkWY8G7CYa1BE1YX4j5bFpita'
const SAFE = '0x8b3a0e2c5d7f9a1b4c6e8d0f2a4b6c8d0e2f4a6b'
const ISSUED = new Date('2026-11-08T01:30:00.900Z')
const solana = { chain: CHAINS.solanaDevnet, multisig: MULTISIG, hot: HOT }

describe('phantomKillUrl', () => {
  it('builds the universal link exactly, with the kill link encoded inside it', () => {
    expect(phantomKillUrl(PAGE, solana, ISSUED)).toBe(
      'https://phantom.app/ul/browse/' +
        'https%3A%2F%2Fsign.agentguard.example%2F%3Faction%3Dkill%26cluster%3Ddevnet' +
        `%26multisig%3D${MULTISIG}%26hot%3D${HOT}%26issued%3D1794101400` +
        '?ref=https%3A%2F%2Fsign.agentguard.example',
    )
  })

  it('takes the cluster from the chain: mainnet is mainnet-beta', () => {
    expect(phantomKillUrl(PAGE, { ...solana, chain: CHAINS.solanaMainnet }, ISSUED)).toContain(
      '%26cluster%3Dmainnet-beta%26',
    )
  })

  it('matches what the signing page builds for the same link', () => {
    const link = `${PAGE}/?action=kill&cluster=devnet&multisig=${MULTISIG}&hot=${HOT}&issued=1794101400`
    expect(phantomKillUrl(PAGE, solana, ISSUED)).toBe(openInPhantom(link))
  })

  it('names only the Safe on Robinhood Chain: the page knows its own hot wallet', () => {
    const testnet = `${PAGE}/?action=kill&cluster=robinhood-testnet&safe=${SAFE}&issued=1794101400`
    expect(phantomKillUrl(PAGE, { chain: CHAINS.robinhoodTestnet, safe: SAFE }, ISSUED)).toBe(
      openInPhantom(testnet),
    )
    const mainnet = phantomKillUrl(PAGE, { chain: CHAINS.robinhood, safe: SAFE }, ISSUED)
    expect(mainnet).toContain('%26cluster%3Drobinhood%26safe%3D0x8b3a')
    expect(mainnet).not.toContain('hot')
  })

  it('treats a trailing slash or a path on the page the same way', () => {
    const plain = phantomKillUrl(PAGE, solana, ISSUED)
    expect(phantomKillUrl(`${PAGE}/`, solana, ISSUED)).toBe(plain)
    expect(phantomKillUrl(`${PAGE}/sign`, solana, ISSUED)).toContain(
      'example%2Fsign%2F%3Faction%3Dkill',
    )
  })

  it('stamps issued in whole unix seconds, as the signing page reads it', () => {
    const at = new Date('1970-01-01T00:00:59.999Z')
    expect(phantomKillUrl(PAGE, solana, at)).toContain('%26issued%3D59?ref=')
  })

  it('refuses a chain the signing page has no cluster for', () => {
    expect(() => phantomKillUrl(PAGE, { chain: CHAINS.baseSepolia, safe: SAFE }, ISSUED)).toThrow(
      'no signing-page',
    )
  })

  it('keeps the chain next to the link builder', () => {
    const kill = phantomKill(PAGE, { chain: CHAINS.robinhoodTestnet, safe: SAFE })
    expect(kill.chain).toBe(CHAINS.robinhoodTestnet)
    expect(kill.link(ISSUED)).toContain('robinhood-testnet')
  })
})
