import { getAddress } from 'viem'
import { chromium, type Browser } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { killData } from '../src/evm/calls.js'
import { MODULE, mockPhantomEvm, stageEvm } from './evm-node.js'
import { heading, lines } from './harness.js'

/** The kill page on Robinhood, with a stand-in for Phantom's EVM provider and the chain. */
let browser: Browser
let s: Awaited<ReturnType<typeof stageEvm>>

beforeAll(async () => {
  browser = await chromium.launch()
})
afterAll(() => browser.close())
beforeEach(async () => {
  s = await stageEvm()
})
afterEach(() => s.server.close())

const now = () => Math.floor(Date.now() / 1000)

async function open(
  options: Parameters<typeof mockPhantomEvm>[1] & { account?: `0x${string}`; issued?: number } = {},
) {
  const page = await browser.newPage()
  await page.addInitScript(mockPhantomEvm(options.account ?? s.state.owners[0]!, options))
  const query = {
    action: 'kill',
    cluster: 'evm-localnet',
    safe: s.state.safe,
    hot: s.state.hot,
    issued: String(options.issued ?? now()),
  }
  await page.goto(`${s.server.origin}/?${new URLSearchParams(query)}`)
  return page
}

const settled = async (page: Awaited<ReturnType<typeof open>>, title: string) =>
  expect.poll(() => heading(page).textContent(), { timeout: 20_000 }).toBe(title)

describe('the kill page on an EVM chain', () => {
  it('sends exactly removeDelegate through the Safe, from the owner, and reads the kill back', async () => {
    const page = await open()
    await settled(page, 'Killed')
    const owner = s.state.owners[0]!
    expect(s.sent).toEqual([
      { from: owner, to: s.state.safe, data: killData(owner, MODULE, s.state.hot), value: '0x0' },
    ])
    expect(
      await page.evaluate(() => (window as never as { __requests: string[] }).__requests),
    ).toContain('wallet_switchEthereumChain')
    expect((await lines(page)).join(' ')).toContain(`${s.state.hot} is no longer a delegate`)
  })

  it('shows what it removes before Phantom asks, and asks again after a rejection', async () => {
    const page = await open({ rejects: 1 })
    await expect
      .poll(() => lines(page), { timeout: 20_000 })
      .toContain('Not sent: Error: User rejected the request.')
    const text = (await lines(page)).join('\n')
    expect(text).toContain(`Safe ${s.state.safe}, on evm-localnet.`)
    expect(text).toContain('50000000 base units')
    expect(s.sent).toEqual([])
    await page.locator('button').click()
    await settled(page, 'Killed')
    expect(s.sent).toHaveLength(1)
  })

  it('refuses another account, before Phantom is asked to send', async () => {
    const page = await open({ account: getAddress('0x00000000000000000000000000000000000a11ce') })
    await settled(page, 'Nothing to sign')
    expect((await lines(page)).join(' ')).toContain("is not this Safe's only owner")
    expect(s.sent).toEqual([])
  })

  it('does not ask Phantom when the Safe would refuse the kill', async () => {
    s.state.refuses = true
    const page = await open()
    await settled(page, 'Nothing to sign')
    expect((await lines(page)).join(' ')).toContain('The Safe would refuse this transaction')
    expect(s.sent).toEqual([])
  })

  it('refuses a Safe with a second owner, even for one of its owners', async () => {
    s.state.owners.push(getAddress('0x00000000000000000000000000000000000a11ce'))
    const page = await open()
    await settled(page, 'Nothing to sign')
    expect((await lines(page)).join(' ')).toContain("is not this Safe's only owner")
    expect(s.sent).toEqual([])
  })

  it('says already killed when the hot wallet is not a delegate', async () => {
    s.state.listed = false
    const page = await open()
    await settled(page, 'Already killed')
    expect(s.sent).toEqual([])
  })

  it('stops when Phantom cannot switch to the chain', async () => {
    const page = await open({ switches: false })
    await settled(page, 'Something went wrong')
    expect((await lines(page)).join(' ')).toContain('Unrecognized chain ID')
    expect(s.sent).toEqual([])
  })

  it('refuses a link older than 15 minutes', async () => {
    const page = await open({ issued: now() - 16 * 60 })
    await settled(page, 'Nothing to sign')
    expect(await lines(page)).toEqual(['This link expired. Use /kill in Telegram for a fresh one.'])
  })

  it('refuses a link whose Safe is not an address', async () => {
    const page = await browser.newPage()
    await page.goto(
      `${s.server.origin}/?action=kill&cluster=evm-localnet&safe=0x12&hot=${s.state.hot}&issued=${now()}`,
    )
    await settled(page, 'This link is not valid')
    expect((await lines(page)).join(' ')).toContain('safe: not an EVM address')
  })
})
