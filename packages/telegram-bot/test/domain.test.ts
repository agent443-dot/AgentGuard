import { describe, expect, it } from 'vitest'
import { alertsFor } from '../src/domain/alerts.js'
import { ATTACK_CODES, attackCodesIn } from '../src/domain/codes.js'
import { formatUsd } from '../src/domain/money.js'
import { ApprovalBook, EventLog } from '../src/domain/replay.js'
import { sign, signatureValid } from '../src/domain/signature.js'
import {
  approvalText,
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

describe('alertsFor', () => {
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
})

describe('message text', () => {
  it('shows every field the owner decides on, with the reason labelled as the agent', () => {
    const text = approvalText(approval())
    expect(text).toContain('<code>research-agent</code>')
    expect(text).toContain('<b>$12.50</b> USDC')
    expect(text).toContain('Chain: Solana devnet')
    expect(text).toContain(`<code>${shortAddress(RECIPIENT)}</code>`)
    expect(text).not.toContain(RECIPIENT)
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
