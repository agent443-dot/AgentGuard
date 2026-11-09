import { getAddress } from 'viem'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MODULE, stageEvm } from './evm-node.js'
import { heading, lines } from './harness.js'

/** The proof page on Robinhood: read-only, no wallet, against a stand-in chain. */
let browser: Browser
let s: Awaited<ReturnType<typeof stageEvm>>
const stranger = getAddress('0x00000000000000000000000000000000000a11ce')
const HEADLINE = 'The most this agent can draw in the next 24 hours: '

beforeAll(async () => {
  browser = await chromium.launch()
})
afterAll(() => browser.close())
beforeEach(async () => {
  s = await stageEvm()
})
afterEach(() => s.server.close())

/** No Phantom at all: the proof must need no wallet. */
async function proof(safe: string = s.state.safe): Promise<Page> {
  const page = await browser.newPage()
  const query = new URLSearchParams({ action: 'proof', cluster: 'evm-localnet', safe })
  await page.goto(`${s.server.origin}/?${query}`)
  await expect
    .poll(() => heading(page).textContent(), { timeout: 20_000 })
    .not.toMatch(/Reading the chain|^$/)
  return page
}

describe('the proof page on an EVM chain', () => {
  it('shows the most the agent can draw in a day, with no wallet and nothing sent', async () => {
    const page = await proof()
    expect(await heading(page).textContent()).toBe(`${HEADLINE}98.5 USDG`)
    const text = (await lines(page)).join('\n')
    expect(text).toContain(`the Allowance Module ${MODULE} lets only the hot wallet ${s.state.hot}`)
    expect(text).toMatch(/Left until \d{4}-\S+: 48\.5 USDG\. Then the daily cap again: 50 USDG\./)
    expect(text).toContain(`Owners: ${s.state.owners[0]}, threshold 1.`)
    expect(text).toContain('It holds 100 USDG.')
    expect(await page.getAttribute('#app', 'data-state')).toBe('done')
    expect(s.sent).toEqual([])
  })

  it('is bounded by the Safe when it holds less than is left', async () => {
    s.state.balance = 10_000_000n
    const page = await proof()
    expect(await heading(page).textContent()).toBe(`${HEADLINE}10 USDG`)
  })

  it('says zero after a kill', async () => {
    s.state.listed = false
    const page = await proof()
    expect(await heading(page).textContent()).toBe(`${HEADLINE}0 USDG`)
    expect((await lines(page))[0]).toMatch(/^No allowance: the hot wallet cannot draw/)
  })

  it('counts no less than nothing left when more was spent than the cap allows', async () => {
    s.state.allowance = [50_000_000n, 60_000_000n, 1440n, 29_000_000n, 3n]
    const page = await proof()
    expect(await heading(page).textContent()).toBe(`${HEADLINE}50 USDG`)
    expect((await lines(page)).join('\n')).toMatch(/: 0 USDG\. Then the daily cap again: 50 USDG\./)
  })

  it.each([
    [
      'the hot wallet as an owner',
      () => s.state.owners.push(s.state.hot),
      'The hot wallet is an owner: it can change the allowance itself.',
    ],
    [
      'a second owner',
      () => s.state.owners.push(stranger),
      'It has 2 owners at threshold 1, not one owner.',
    ],
    [
      'another singleton behind its proxy',
      () => (s.state.singleton = stranger),
      `The Safe runs ${stranger}, not SafeL2 1.4.1`,
    ],
    [
      'an allowance that resets hourly',
      () => (s.state.allowance = [50_000_000n, 0n, 60n, 29_000_000n, 3n]),
      'The allowance resets every 60 minutes, not daily.',
    ],
    ['another module', () => s.state.otherModules.push(stranger), `Module ${stranger} is enabled`],
    [
      'another delegate',
      () => s.state.otherDelegates.push(stranger),
      `Delegate ${stranger} of the Allowance Module can draw too.`,
    ],
    [
      'an allowance in another token',
      () => s.state.otherTokens.push(stranger),
      `has allowances in ${stranger}, not USDG`,
    ],
  ])('refuses to verify a Safe with %s', async (_case, arrange, found) => {
    arrange()
    const page = await proof()
    expect(await heading(page).textContent()).toBe('Not verified')
    expect((await lines(page)).join('\n')).toContain(found)
    expect(await page.getAttribute('#app', 'data-state')).toBe('stop')
  })

  it('says it could not verify when the RPC fails a read, never counting fewer rights', async () => {
    s.state.delegatesFail = true
    const page = await proof()
    expect(await heading(page).textContent()).toBe('Not verified')
    expect((await lines(page))[0]).toMatch(/^This could not be verified: the RPC did not answer/)
  })

  it('says so when there is no Safe at the address', async () => {
    s.state.exists = false
    const page = await proof()
    expect(await heading(page).textContent()).toBe('Not verified')
    expect((await lines(page))[0]).toBe(`There is no Safe at ${s.state.safe} on evm-localnet.`)
  })
})
