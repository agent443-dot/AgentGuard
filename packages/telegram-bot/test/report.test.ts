import { describe, expect, it } from 'vitest'
import { type AgentReport, reportPages, weeklyDue } from '../src/domain/report.js'

const FROM = new Date('2026-11-02T12:00:00.000Z')
const TO = new Date('2026-11-09T12:00:00.000Z')

const agent = (overrides: Partial<AgentReport> = {}): AgentReport => ({
  agentId: 'research-agent',
  spent: '12500000',
  payments: 3,
  refused: {},
  domains: [],
  ...overrides,
})

describe('reportPages', () => {
  it('gives each agent its spend, refusals by count and top domains', () => {
    const [page] = reportPages(
      [
        agent({
          refused: { DOMAIN_NOT_ALLOWED: 1, DAILY_EXCEEDED: 4, PAUSED: 0 },
          domains: [
            { domain: 'a.example', spent: '1000000' },
            { domain: 'b.example', spent: '9000000' },
            { domain: 'c.example', spent: '500000' },
            { domain: 'd.example', spent: '200000' },
            { domain: 'e.example', spent: '100000' },
            { domain: 'f.example', spent: '1' },
          ],
        }),
        agent({ agentId: '<b>x</b>', spent: '1000000', payments: 1 }),
      ],
      FROM,
      TO,
    )
    expect(page).toBe(
      [
        '<b>Report</b> 2026-11-02 12:00:00 UTC to 2026-11-09 12:00:00 UTC',
        '<code>research-agent</code>: $12.50 in 3 payments',
        '  Refused: DAILY_EXCEEDED ×4, DOMAIN_NOT_ALLOWED ×1',
        '  Top domains: b.example $9.00, a.example $1.00, c.example $0.50, d.example $0.20, ' +
          'e.example $0.10',
        '<code>&lt;b&gt;x&lt;/b&gt;</code>: $1.00 in 1 payment',
      ].join('\n'),
    )
  })

  it('says so when nothing happened', () => {
    expect(reportPages([], FROM, TO)[0]).toContain('No agent paid or was refused in this period.')
  })

  it("pages a long report without splitting an agent, every page inside Telegram's limit", () => {
    const many = Array.from({ length: 300 }, (_, i) =>
      agent({
        agentId: `agent-${i}`,
        refused: { DAILY_EXCEEDED: 2, PER_TX_EXCEEDED: 1 },
        domains: [{ domain: 'api.example.com', spent: '1000000' }],
      }),
    )
    const pages = reportPages(many, FROM, TO)
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.every((page) => page.length <= 4096)).toBe(true)
    expect(pages[0]).toMatch(new RegExp(`^\\(1/${pages.length}\\) <b>Report</b>`))
    const agents = pages.join('\n').match(/<code>agent-\d+<\/code>/g)
    expect(agents).toHaveLength(300)
    for (const page of pages.slice(1)) {
      expect(page).toMatch(/^\(\d+\/\d+\) <code>agent-/)
    }
  })
})

describe('weeklyDue', () => {
  const monday9 = { weekday: 1, hourUtc: 9 }

  it('is due once in the scheduled hour of the scheduled day', () => {
    const at = new Date('2026-11-09T09:30:00.000Z')
    expect(weeklyDue(at, monday9, undefined)).toBe('2026-11-09')
    expect(weeklyDue(at, monday9, '2026-11-09')).toBeUndefined()
    expect(weeklyDue(new Date('2026-11-16T09:00:00.000Z'), monday9, '2026-11-09')).toBe(
      '2026-11-16',
    )
  })

  it('is not due in another hour or on another day', () => {
    expect(weeklyDue(new Date('2026-11-09T10:00:00.000Z'), monday9, undefined)).toBeUndefined()
    expect(weeklyDue(new Date('2026-11-10T09:00:00.000Z'), monday9, undefined)).toBeUndefined()
  })
})
