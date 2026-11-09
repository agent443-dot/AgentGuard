import { getAddress } from 'viem'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MODULE, stageEvm } from './evm-node.js'
import { heading, lines } from './harness.js'

/** The proof page on Robinhood: read-only, no wallet, against a stand-in chain. */
let browser: Browser
let s: Awaited<ReturnType<typeof stageEvm>>
const stranger = getAddress('0x00000000000000000000000000000000000a11ce')

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
  it('shows the most the agent can draw today, with no wallet and nothing sent', async () => {
    const page = await proof()
    expect(await heading(page).textContent()).toBe('The most this agent can draw today: 48.5 USDG')
    const text = (await lines(page)).join('\n')
    expect(text).toContain(`the Allowance Module ${MODULE} lets only the hot wallet ${s.state.hot}`)
    expect(text).toContain('Daily cap: 50 USDG every 1440 minutes. Left today: 48.5 USDG.')
    expect(text).toContain(`Owners: ${s.state.owners[0]}, threshold 1.`)
    expect(text).toContain('It holds 100 USDG.')
    expect(await page.getAttribute('#app', 'data-state')).toBe('done')
    expect(s.sent).toEqual([])
  })

  it('is bounded by the Safe when it holds less than is left', async () => {
    s.state.balance = 10_000_000n
    const page = await proof()
    expect(await heading(page).textContent()).toBe('The most this agent can draw today: 10 USDG')
  })

  it('says zero after a kill', async () => {
    s.state.listed = false
    const page = await proof()
    expect(await heading(page).textContent()).toBe('The most this agent can draw today: 0 USDG')
    expect((await lines(page))[0]).toMatch(/^No allowance: the hot wallet cannot draw/)
  })

  it.each([
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

  it('says so when there is no Safe at the address', async () => {
    s.state.exists = false
    const page = await proof()
    expect(await heading(page).textContent()).toBe('Not verified')
    expect((await lines(page))[0]).toBe(`There is no Safe at ${s.state.safe} on evm-localnet.`)
  })
})
