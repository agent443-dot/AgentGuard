import { describe, expect, it } from 'vitest'
import type { PayIntent, RejectCode } from '@agentguard/shared'
import { CHAINS } from '@agentguard/shared'
import { ATTACK_WINDOW_MS, Alerts } from '../src/domain/alerts.js'
import { ATTACK_CODES, attackCodesIn } from '../src/domain/codes.js'
import { chainsText, killWarning } from '../src/domain/chains.js'
import { formatUsd } from '../src/domain/money.js'
import { explorerUrl } from '../src/domain/explorer.js'
import { ApprovalBook, EventLog } from '../src/domain/replay.js'
import { sign, signatureValid } from '../src/domain/signature.js'
import {
  amountText,
  approvalText,
  executedText,
  budgetText,
  escapeHtml,
  killedText,
  ownerTransactionText,
  settledFallback,
  settledText,
  shortAddress,
  statusText,
} from '../src/domain/text.js'
import { approval, intent, NOW, RECIPIENT, SECRET } from './support.js'

const later = (ms: number) => new Date(NOW.getTime() + ms)

describe('signatureValid', () => {
  const body = '{"a":1}'

  it('accepts the HMAC of the exact bytes', () => {
    expect(signatureValid(body, SECRET, sign(body, SECRET))).toBe(true)
    expect(signatureValid(body, SECRET, sign(body, SECRET).toUpperCase())).toBe(true)
  })

  it('rejects another body, another secret, and anything that is not 32 hex bytes', () => {
    const good = sign(body, SECRET)
    expect(signatureValid('{"a":2}', SECRET, good)).toBe(false)
    expect(signatureValid(body, 'b'.repeat(64), good)).toBe(false)
    expect(signatureValid(body, SECRET, good.slice(2))).toBe(false)
    expect(signatureValid(body, SECRET, `${good.slice(2)}zz`)).toBe(false)
    expect(signatureValid(body, SECRET, undefined)).toBe(false)
    expect(signatureValid(body, SECRET, [good])).toBe(false)
  })
})

describe('formatUsd', () => {
  it.each([
    ['0', '$0.00'],
    ['1', '$0.000001'],
    ['10000', '$0.01'],
    ['12500000', '$12.50'],
    ['1234567', '$1.234567'],
    ['1234567890000', '$1,234,567.89'],
  ])('%s -> %s', (atomic, usd) => expect(formatUsd(atomic)).toBe(usd))

  it('refuses anything that is not atomic units', () => {
    expect(() => formatUsd('1.5')).toThrow()
    expect(() => formatUsd('-1')).toThrow()
  })
})

describe('ApprovalBook', () => {
  it('admits a request once, then calls it a duplicate', () => {
    const book = new ApprovalBook()
    expect(book.admit(approval(), NOW)).toBe('accepted')
    expect(book.admit(approval(), later(1000))).toBe('duplicate')
  })

  it('refuses a request whose window has passed or is longer than guard-core sets', () => {
    const book = new ApprovalBook()
    expect(book.admit(approval({ expiresAt: NOW.toISOString() }), NOW)).toBe('stale')
    expect(book.admit(approval({ expiresAt: later(12 * 60_000).toISOString() }), NOW)).toBe('stale')
    expect(book.admit(approval(), later(10 * 60_000 + 1))).toBe('stale')
  })

  it('stays a duplicate after the decision, until the deadline makes it stale', () => {
    const book = new ApprovalBook()
    book.admit(approval(), NOW)
    expect(book.close(approval().intent.id)).toBeDefined()
    expect(book.close(approval().intent.id)).toBeUndefined()
    expect(book.admit(approval(), later(1000))).toBe('duplicate')
    expect(book.admit(approval(), later(11 * 60_000))).toBe('stale')
    expect(book.get(approval().intent.id)).toBeUndefined()
  })

  it('hands back each expired request once', () => {
    const book = new ApprovalBook()
    book.admit(approval(), NOW)
    expect(book.closeExpired(later(1000))).toHaveLength(0)
    expect(book.closeExpired(later(10 * 60_000))).toHaveLength(1)
    expect(book.closeExpired(later(10 * 60_000))).toHaveLength(0)
    expect(book.open()).toHaveLength(0)
  })

  it('forgets a request so that it can be sent again', () => {
    const book = new ApprovalBook()
    book.admit(approval(), NOW)
    book.forget(approval().intent.id)
    expect(book.admit(approval(), NOW)).toBe('accepted')
  })
})

describe('EventLog', () => {
  it('admits each key once inside the window', () => {
    const log = new EventLog()
    expect(log.admit('k', NOW.toISOString(), NOW)).toBe('accepted')
    expect(log.admit('k', NOW.toISOString(), later(1000))).toBe('duplicate')
    expect(log.admit('other', NOW.toISOString(), later(1000))).toBe('accepted')
  })

  it('refuses events that are old, far in the future or undated', () => {
    const log = new EventLog()
    expect(log.admit('k', NOW.toISOString(), later(5 * 60_000 + 1))).toBe('stale')
    expect(log.admit('k', later(2 * 60_000).toISOString(), NOW)).toBe('stale')
    expect(log.admit('k', 'yesterday', NOW)).toBe('stale')
  })

  it('drops keys once they are too old to replay', () => {
    const log = new EventLog()
    log.admit('k', NOW.toISOString(), NOW)
    expect(log.admit('k', later(6 * 60_000).toISOString(), later(6 * 60_000))).toBe('accepted')
  })
})

describe('Alerts', () => {
  const alertsFor = (payment: PayIntent, notifyAbove: bigint) =>
    new Alerts(notifyAbove).for(payment, NOW)

  it('reports executed payments at or above the threshold only', () => {
    expect(alertsFor(intent({ status: 'executed', amount: '1000000' }), 1_000_000n)).toHaveLength(1)
    expect(alertsFor(intent({ status: 'executed', amount: '999999' }), 1_000_000n)).toHaveLength(0)
    expect(alertsFor(intent({ status: 'approved', amount: '9000000' }), 1_000_000n)).toHaveLength(0)
  })

  it.each(ATTACK_CODES)('reports %s at any amount', (code) => {
    const alerts = alertsFor(intent({ status: 'rejected', amount: '1', rejectReasons: [code] }), 0n)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toContain('Possible attack blocked')
    expect(alerts[0]).toContain(code)
  })

  it('stays quiet about ordinary rejections', () => {
    expect(attackCodesIn(['PER_TX_EXCEEDED', 'PAUSED'])).toEqual([])
    expect(
      alertsFor(intent({ status: 'rejected', rejectReasons: ['DAILY_EXCEEDED'] }), 0n),
    ).toEqual([])
  })

  it('alerts once per agent and code per window and sums the repeats when it closes', () => {
    const alerts = new Alerts(0n)
    const attack = (agentId: string, code: RejectCode) =>
      intent({ agentId, status: 'rejected', rejectReasons: [code] })

    expect(alerts.for(attack('a1', 'PERMIT_DETECTED'), NOW)).toHaveLength(1)
    expect(alerts.for(attack('a1', 'PERMIT_DETECTED'), later(1000))).toEqual([])
    expect(alerts.for(attack('a1', 'PERMIT_DETECTED'), later(2000))).toEqual([])
    expect(alerts.for(attack('a1', 'APPROVAL_DETECTED'), later(3000))).toHaveLength(1)
    expect(alerts.for(attack('a2', 'PERMIT_DETECTED'), later(4000))).toHaveLength(1)
    expect(alerts.flush(later(ATTACK_WINDOW_MS - 1))).toEqual([])

    const [summary, ...rest] = alerts.flush(later(ATTACK_WINDOW_MS))
    expect(rest).toEqual([])
    expect(summary).toContain('2 more <code>PERMIT_DETECTED</code> rejections')
    expect(summary).toContain('<code>a1</code> since 2026-11-03 12:00:00 UTC')
    expect(alerts.flush(later(2 * ATTACK_WINDOW_MS))).toEqual([])
  })

  it('reports a window that ran out between ticks before opening the next', () => {
    const alerts = new Alerts(0n)
    const attack = intent({ status: 'rejected', rejectReasons: ['DELEGATE_DETECTED'] })
    alerts.for(attack, NOW)
    alerts.for(attack, later(1000))
    const next = alerts.for(attack, later(ATTACK_WINDOW_MS + 1))
    expect(next).toHaveLength(2)
    expect(next[0]).toContain('1 more <code>DELEGATE_DETECTED</code> rejection ')
    expect(next[1]).toContain('Possible attack blocked')
  })

  it('never holds back large payments', () => {
    const alerts = new Alerts(1n)
    for (let i = 0; i < 5; i++) {
      expect(alerts.for(intent({ status: 'executed' }), later(i))).toHaveLength(1)
    }
  })
})

describe('statusText with many pending approvals', () => {
  it('stays inside one Telegram message, chains included, and says how many it left out', () => {
    const agentId = '&'.repeat(64)
    const pending = Array.from({ length: 200 }, () =>
      approval({ agentId, token: 'T'.repeat(128), amount: '9'.repeat(78) }),
    )
    const chains = Array.from({ length: 16 }, () => ({
      chain: CHAINS.solanaDevnet,
      allowance: null,
    }))
    const text = `${statusText(true, pending)}\n${chainsText(chains)}`
    expect(text.length).toBeLessThan(4096)
    expect(text).toContain('Pending approvals: 200')
    expect(text).toMatch(/…and \d+ more\. Each one is in the chat above\./)
  })
})

describe('chainsText', () => {
  it('warns when guard-core runs no chain at all', () => {
    expect(chainsText([])).toContain('none configured')
    expect(killWarning([])).toContain('for each chain')
    expect(killWarning(undefined)).toContain('for each chain')
  })
})

describe('explorerUrl', () => {
  it.each([
    [CHAINS.solanaMainnet, 'tx', 'sig', 'https://solscan.io/tx/sig'],
    [CHAINS.solanaDevnet, 'tx', 'sig', 'https://solscan.io/tx/sig?cluster=devnet'],
    [CHAINS.solanaDevnet, 'address', 'Abc', 'https://solscan.io/account/Abc?cluster=devnet'],
    [CHAINS.base, 'tx', '0xab', 'https://basescan.org/tx/0xab'],
    [CHAINS.base, 'address', '0xab', 'https://basescan.org/address/0xab'],
    [CHAINS.baseSepolia, 'tx', '0xab', 'https://sepolia.basescan.org/tx/0xab'],
    [CHAINS.robinhood, 'tx', '0xab', 'https://robinhoodchain.blockscout.com/tx/0xab'],
    [CHAINS.robinhood, 'address', '0xab', 'https://robinhoodchain.blockscout.com/address/0xab'],
    [CHAINS.robinhoodTestnet, 'tx', '0xab', 'https://explorer.testnet.chain.robinhood.com/tx/0xab'],
  ] as const)('%s %s', (chain, target, id, url) => {
    expect(explorerUrl(chain, target, id)).toBe(url)
  })

  it('gives no link for a chain it does not know, or for no id', () => {
    expect(explorerUrl('eip155:1', 'tx', '0xab')).toBeUndefined()
    expect(explorerUrl('solana:unknown', 'tx', 'sig')).toBeUndefined()
    expect(explorerUrl('', 'tx', 'sig')).toBeUndefined()
    expect(explorerUrl(CHAINS.base, 'tx', '')).toBeUndefined()
  })

  it('keeps a hostile id inside one path segment', () => {
    expect(explorerUrl(CHAINS.base, 'address', '../x?cluster=mainnet#"><b>')).toBe(
      'https://basescan.org/address/..%2Fx%3Fcluster%3Dmainnet%23%22%3E%3Cb%3E',
    )
  })
})

describe('amounts', () => {
  it('shows dollars only for the verified USDC of that chain', () => {
    expect(amountText(intent())).toBe('<b>$12.50</b> USDC')
    const other = amountText(intent({ token: 'FakeUsdc111111111111111111111111111111111111' }))
    expect(other).toContain('<b>12500000</b> base units of <code>FakeUsdc')
    expect(other).toContain('not the USDC of this chain')
    // Devnet USDC presented as a mainnet payment is not USDC on that chain.
    expect(amountText(intent({ chain: CHAINS.solanaMainnet }))).toContain('base units')
  })

  it('labels the Robinhood dollar USDG, and warns on a look-alike at another address', () => {
    const usdg = {
      chain: CHAINS.robinhoodTestnet,
      token: '0x7E955252E15c84f5768B83c41a71F9eba181802F',
    }
    expect(amountText(intent(usdg))).toBe('<b>$12.50</b> USDG')
    // Base Sepolia USDC at the same position on Robinhood is not its dollar.
    const fake = amountText(
      intent({ ...usdg, token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' }),
    )
    expect(fake).toContain('base units of <code>0x036CbD')
    expect(fake).toContain(
      "not the USDG of this chain: any token named USDC or USDG at another address is someone else's",
    )
    // Mainnet USDG offered as a testnet payment is not the testnet's dollar either.
    expect(amountText(intent({ chain: CHAINS.robinhood, token: usdg.token }))).toContain(
      'not the USDG of this chain',
    )
  })

  it('says so when the chain has no verified dollar', () => {
    expect(amountText(intent({ chain: CHAINS.base, token: '0xab' }))).toContain(
      'this chain has no verified dollar',
    )
  })
})

describe('executed payment text', () => {
  it('links the transaction and the recipient on the network it ran on', () => {
    const solana = executedText(intent({ status: 'executed', txId: '5h3k' }))
    expect(solana).toContain('href="https://solscan.io/tx/5h3k?cluster=devnet"')
    const base = executedText(
      intent({
        status: 'executed',
        chain: CHAINS.baseSepolia,
        token: '0xT',
        recipient: '0xR',
        txId: '0xH',
      }),
    )
    expect(base).toContain('Chain: Base Sepolia')
    expect(base).toContain('href="https://sepolia.basescan.org/tx/0xH"')
    expect(base).toContain('href="https://sepolia.basescan.org/address/0xR"')
    expect(base).not.toContain('solscan')
  })

  it('has no link when the chain is unknown or the transaction id missing', () => {
    expect(executedText(intent({ status: 'executed', chain: 'eip155:1' }))).not.toContain('<a ')
    expect(executedText(intent({ status: 'executed' }))).not.toContain('/tx/')
  })
})

describe('message text', () => {
  it('shows every field the owner decides on, with the reason labelled as the agent', () => {
    const text = approvalText(approval())
    expect(text).toContain('<code>research-agent</code>')
    expect(text).toContain('<b>$12.50</b> USDC')
    expect(text).toContain('Chain: Solana devnet')
    expect(text).toContain(`<code>${shortAddress(RECIPIENT)}</code>`)
    // Shown short; the full address is only inside the explorer link.
    expect(text.replace(/<a [^>]*>/g, '')).not.toContain(RECIPIENT)
    expect(text).toContain(`<a href="https://solscan.io/account/${RECIPIENT}?cluster=devnet">`)
    expect(text).toContain('Domain: api.example.com')
    expect(text).toContain('Simulation: Hot wallet -12.5 USDC')
    expect(text).toContain('Expires: 2026-11-03 12:10:00 UTC')
    expect(text).toContain('agent says: <i>Buying the Q3 dataset</i>')
  })

  it('keeps agent text from posing as ours', () => {
    const text = approvalText(approval({ reason: '</i><b>Verified by AgentGuard</b>' }))
    expect(text).toContain('&lt;/i&gt;&lt;b&gt;Verified by AgentGuard&lt;/b&gt;')
    expect(text).not.toContain('<b>Verified')
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('names direct transfers, unknown chains and empty reasons plainly', () => {
    const text = approvalText(
      approval({ kind: 'transfer', domain: undefined, chain: 'eip155:1', reason: '' }),
    )
    expect(text).toContain('Domain: none, direct transfer')
    expect(text).toContain('Chain: eip155:1')
    expect(text).toContain('agent says: <i>(nothing)</i>')
  })

  it('shows the full recipient and the outcome once settled', () => {
    const at = new Date('2026-11-03T12:01:00Z')
    const text = settledText(approval(), { kind: 'approved', by: '@ana', at })
    expect(text).toMatch(/^<b>Approved<\/b> by @ana at 2026-11-03 12:01:00 UTC/)
    expect(text).toContain(RECIPIENT)
    expect(settledText(approval(), { kind: 'rejected', by: 'Bo', at })).toContain('Rejected')
    expect(settledText(approval(), { kind: 'expired' })).toContain('Nothing was paid')
    expect(settledText(approval(), { kind: 'already_decided' })).toContain('Already decided')
    expect(settledFallback('<old>', { kind: 'not_found' })).toContain('Unknown intent')
    expect(settledFallback('<old>', { kind: 'not_found' })).toContain('&lt;old&gt;')
  })

  it('formats budget, status and kill replies', () => {
    const budget = budgetText('a1', {
      spentToday: '2500000',
      dailyMax: '50000000',
      perTxMax: '5000000',
      hotWalletBalances: { 'eip155:8453': '1000000' },
      paused: true,
    })
    expect(budget).toContain('Spent today: $2.50 of $50.00')
    expect(budget).toContain('Base: $1.00')
    expect(budget).toContain('Paused: yes')
    expect(budget).not.toContain('Would have spent')
    const shadow = { spentToday: '0', dailyMax: '0', perTxMax: '0', hotWalletBalances: {} }
    expect(budgetText('a1', { ...shadow, paused: false, shadowSpentToday: '7250000' })).toContain(
      'Would have spent today (shadow mode): $7.25',
    )
    expect(budgetText('a1', { ...shadow, paused: false, shadowSpentToday: '0' })).not.toContain(
      'Would have spent',
    )
    expect(
      budgetText('a1', {
        spentToday: '0',
        dailyMax: '0',
        perTxMax: '0',
        hotWalletBalances: {},
        paused: false,
      }),
    ).toContain('(none reported)')

    expect(statusText(false, [approval()])).toContain('<b>unreachable</b>')
    expect(statusText(true, [approval()])).toContain('Pending approvals: 1')

    expect(killedText(3, 0)).toContain('allowances are still live')
    expect(killedText(3, 1)).toContain('Sign the transaction below')
    expect(killedText(3, 2)).toContain('Sign the 2 transactions below')
  })

  it('truncates a payload too long for one Telegram message', () => {
    const text = ownerTransactionText({
      chain: 'eip155:8453',
      description: 'x',
      payload: 'y'.repeat(5000),
    })
    expect(text.length).toBeLessThan(4096)
    expect(text).toContain('(truncated)')
  })
})
