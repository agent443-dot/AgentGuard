// Images for how-to.md. Render with the site from main, which has Solana live:
//   git show origin/main:site/index.html > /tmp/main-site.html
//   AG_SITE=/tmp/main-site.html node marketing/videos/assets/src/render.cjs howto
const c = require('./cards.cjs')

const CTA = [
  ['Star it and read the code', 'github.com/agent443-dot/AgentGuard'],
  ['Run the setup wizard', 'pnpm --filter create-agentguard start'],
  ['Found a hole? Report it privately', 'SECURITY.md · Security → Report a vulnerability'],
]
const killWarning =
  '<b>Kill switch.</b> <b>Kill everything</b> pauses every agent and prepares, for Robinhood Chain and Solana, the owner transaction that sets the allowance to 0 and removes the delegate.<br>Once guard-core confirms, you get a Phantom button for each chain to remove its onchain limit, after you confirm in Phantom.<br>Continue?'
const h = (name, html) => ({ name, size: 'h', html })
const site = (name, sel, extra = {}) => ({ name, sel, width: 1280, height: 720, ...extra })

module.exports = {
  howto: [
    h('01-boot', c.title({ kicker: 'AgentGuard // boot sequence', lines: ['Your robot can pay.', '*You stay in charge.*'], xl: true })),
    site('02-site-hero', '.hero'),
    h(
      '03-shields',
      c.list({
        kicker: 'Five shields, every payment',
        items: [
          ['1', 'Your rules', 'How much per payment, per day, which sites. Anything else: no.'],
          ['2', 'A practice run', 'The exact payment is simulated before anything is signed.'],
          ['3', 'Your yes', 'Big payments, price jumps and new payees go to you on Telegram.'],
          ['4', 'A daily lock, onchain', 'Your vault lets out only the daily cap. It holds even if the guard breaks.'],
          ['5', 'One button', '/kill pauses every agent. One Phantom signature shuts the vault.'],
        ],
      }),
    ),
    site('04-site-how', '#how'),
    site('05-site-approval', '.phone'),
    site('06-site-money', '.flow-grid', { setup: 'launchCaps' }),
    h('07-chat-kill', c.chat({ kicker: 'Shield 5 · Telegram', messages: [['me', '/kill'], ['bot', killWarning, ['!Kill everything', 'Cancel']]] })),
    h(
      '08-four-moves',
      c.list({
        kicker: 'How to use it · four moves',
        items: [
          ['1', 'Run the setup wizard', 'Your keys, your guard, your signing page, your vaults signed in Phantom.'],
          ['2', 'Connect your agent', 'One setup command: Claude Code, Claude Desktop, Cursor or any MCP client.'],
          ['3', 'Watch it in shadow mode', 'It tries to pay; nothing is signed. You see what it would have spent.'],
          ['4', 'Set your limits, go live', 'In Telegram: /policy, /allow, /mode live. Then /report.'],
        ],
      }),
    ),
    h(
      '09-terminal',
      c.terminal({
        kicker: 'Moves 1 and 2 · your terminal',
        lines: [
          '# 1. The wizard: keys on your machine, your guard, Phantom links',
          'pnpm --filter create-agentguard start',
          '# --dry-run prints every command and runs none',
          '# 2. Connect your agent (or claude-desktop, cursor, generic)',
          'pnpm --filter @agentguard/mcp-server run setup claude-code',
        ],
      }),
    ),
    h(
      '10-telegram',
      c.list({
        kicker: 'Moves 3 and 4 · Telegram',
        items: [
          ['›', '/mode <agent> shadow', 'Evaluates and simulates every payment, signs none.'],
          ['›', '/policy <agent>', 'Careful ($1 / $5 a day) or Standard ($5 / $20 a day) presets.'],
          ['›', '/allow <agent> <domain>', 'Only the sites you trust.'],
          ['›', '/mode <agent> live', 'Asks to confirm and shows what shadow mode would have spent.'],
          ['›', '/report  ·  /kill', 'Seven days at a glance. The button, if anything feels wrong.'],
        ],
      }),
    ),
    h(
      '11-extras',
      c.list({
        kicker: 'Extra armour',
        items: [
          ['✓', 'A budget per task', 'Its own limit, websites and expiry.'],
          ['✓', 'A breaker', 'Paying too fast? It trips. Default: 10 payments a minute.'],
          ['✓', 'Price jump or new payee', 'Goes to you, even below your threshold.'],
          ['✓', 'A receipt for every payment', 'Signed, so anyone can check it.'],
        ],
      }),
    ),
    site('12-site-chains', '#chains'),
    h('13-cta', c.cta({ heading: ['Give your robot pocket money,', '*not your keys.*'], items: CTA })),
    h('thumb', c.title({ kicker: 'How to use AgentGuard', lines: ['Pocket money.', '*Not your keys.*'], xl: true })),
  ],
}
