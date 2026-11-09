// Images for Day 1–7. Every fact comes from README.md, docs/, LAUNCH.md, SECURITY.md or site/index.html.
const c = require('./cards.cjs')

const CTA = [
  ['Star it and read the code', 'github.com/agent443-dot/AgentGuard'],
  ['Run your own copy', 'docs/self-host.md'],
  ['Found a hole? Report it privately', 'SECURITY.md · Security → Report a vulnerability'],
]
const PLACEHOLDER = 'placeholder addresses'

const killWarning =
  '<b>Kill switch.</b> <b>Kill everything</b> pauses every agent and prepares, for Robinhood Chain, the owner transaction that sets the allowance to 0 and removes the delegate.<br>Once guard-core confirms, you get a Phantom button for each chain to remove its onchain limit, after you confirm in Phantom.<br>Continue?'
const killEngaged =
  '<b>Kill switch engaged.</b> guard-core has paused 1 agent and signs no more payments.<br><b>The onchain limit is still live on Robinhood Chain.</b> Tap the Phantom button and confirm to remove it. The button expires in 15 minutes, or when another kill replaces it.'
const signUrl = 'https://<your-signing-page>/?action=kill&cluster=robinhood&safe=<your Safe>&issued=…'

module.exports = {
  'day-01': [
    { name: '01-hook', html: c.title({ kicker: 'Launch day · 9 Nov 2026', lines: ['Your AI agent', 'can pay.', '*It never holds a key.*'], xl: true }) },
    { name: '02-site-hero', sel: '.hero' },
    { name: '03-flow', html: c.flow() },
    { name: '04-formula', html: c.formula({}) },
    { name: '05-site-stats', sel: '.stats' },
    {
      name: '06-status',
      html: c.list({
        kicker: 'Where we are, plainly',
        heading: ['Live today.', '*Early, too.*'],
        items: [
          ['✓', 'Live on Robinhood Chain mainnet', 'USDG · launch cap 20 a day'],
          ['→', 'Solana mainnet next', 'USDC · Squads spending limit'],
          ['→', 'Base later', 'Tested on Base Sepolia'],
          ['!', 'New software. Known risks are written down.', 'docs/final-report.md → Known risks'],
        ],
      }),
    },
    { name: '07-cta', html: c.cta({ items: CTA }) },
    { name: 'thumb', html: c.title({ kicker: 'Open source launch', lines: ['Agents pay.', '*Keys stay home.*'], xl: true }) },
  ],
  'day-02': [
    { name: '01-hook', html: c.title({ lines: ['Would you hand', 'an AI agent your', '*private key?*'], xl: true }) },
    {
      name: '02-compare',
      html: c.list({
        kicker: 'Two ways to let an agent pay',
        heading: ['Hold a key,', 'or *ask first.*'],
        items: [
          ['✕', 'The agent holds a key', 'A bad prompt or a bug can move everything that key controls.'],
          ['✓', 'The agent asks AgentGuard', 'Policy → simulation → your OK above a threshold. It holds no key.'],
        ],
      }),
    },
    { name: '03-site-how', sel: '#how' },
    {
      name: '04-cannot',
      html: c.list({
        kicker: 'What the agent cannot do',
        items: [
          ['✕', 'Touch a key', 'The hot wallet key lives only in guard-core.'],
          ['✕', 'Change its own limits', 'The owner sets the policy. The agent can only read its budget.'],
          ['✕', 'Skip approval', 'At or above your threshold, it waits for you on Telegram.'],
          ['✕', 'Pay anyone or any site', 'Not on the allowlist means rejected. Empty means deny all.'],
          ['!', 'Be steered by paid content', 'Marked as data, not instructions. Limited, not solved.'],
        ],
      }),
    },
    { name: '05-cta', html: c.cta({ items: CTA }) },
    { name: 'thumb', html: c.title({ kicker: 'The problem', lines: ['Agents with', 'wallets need', '*a guard.*'], xl: true }) },
  ],
  'day-03': [
    { name: '01-hook', html: c.title({ lines: ['The most your', 'agent can lose', '*in one day.*'], xl: true }) },
    { name: '02-flow', html: c.flow() },
    { name: '03-site-calculator', sel: '.flow-grid .card:nth-child(2)', setup: 'launchCaps' },
    { name: '04-formula', html: c.formula({}) },
    {
      name: '05-same-bound',
      html: c.list({
        kicker: 'Same bound, different path',
        heading: ['Read the', '*fine print.*'],
        items: [
          ['✓', 'Solana: Squads spending limit', 'The hot wallet is the only destination. A stolen hot key can only move the cap into the hot wallet.'],
          ['!', 'Safe chains: Allowance Module', 'A stolen hot key can send the day’s cap to any address, unseen by guard-core.'],
          ['=', 'Either way: cap + hot wallet balance', 'Keep the vault small. Only what agents need for the coming days.'],
        ],
      }),
    },
    { name: '06-cta', html: c.cta({ items: CTA }) },
    { name: 'thumb', html: c.title({ kicker: 'Onchain daily cap', lines: ['Your worst day,', '*capped onchain.*'], xl: true }) },
  ],
  'day-04': [
    { name: '01-hook', html: c.title({ lines: ['Something looks', 'wrong. Stop it', 'in *two steps.*'], xl: true }) },
    { name: '02-chat-kill', html: c.chat({ kicker: 'Step 1 · Telegram', messages: [['me', '/kill'], ['bot', killWarning, ['!Kill everything', 'Cancel']]] }) },
    { name: '03-chat-engaged', html: c.chat({ kicker: 'Step 1 · guard-core paused', messages: [['bot', killEngaged, ['!Open Robinhood Chain kill in Phantom']]] }) },
    {
      name: '04-sign-kill',
      html: c.sign({
        kicker: 'Step 2 · your signing page',
        url: signUrl,
        heading: 'Kill the hot wallet',
        lines: [
          'Kill: remove the hot wallet <hot wallet> as a delegate of the Allowance Module, with its allowances.',
          'Safe <your Safe>, on robinhood.',
          'Afterwards the hot wallet cannot draw from the Safe until a new allowance is set.',
          'Phantom should show no token and no ETH leaving your account, only the network fee. Reject anything else.',
        ],
        tag: PLACEHOLDER,
      }),
    },
    {
      name: '05-sign-killed',
      html: c.sign({
        kicker: 'Read back from the chain',
        url: signUrl,
        heading: 'Killed',
        tone: 'done',
        lines: [
          'The hot wallet <hot wallet> is no longer a delegate of Safe <your Safe>.',
          'It can no longer draw from the Safe.',
          'In Telegram, check /status that guard-core is paused, or run /kill → Kill everything if you have not.',
        ],
        tag: PLACEHOLDER,
      }),
    },
    {
      name: '06-steps',
      html: c.list({
        kicker: 'The kill, in order',
        items: [
          ['1', '/kill → Kill everything', 'guard-core pauses every agent. Payments are refused with PAUSED.'],
          ['2', 'One Phantom signature', 'On the signing page you host. Removes the onchain limit.'],
          ['3', '/status', 'Check the chain shows no limit left.'],
          ['!', 'What is left', 'The hot wallet keeps its balance. That is the bounded part of the loss.'],
        ],
      }),
    },
    { name: '07-cta', html: c.cta({ items: CTA }) },
    { name: 'thumb', html: c.title({ kicker: 'Kill switch', lines: ['/kill', '+ *one signature.*'], xl: true }) },
  ],
  'day-05': [
    { name: '01-title', size: 'h', html: c.title({ kicker: 'Explainer · 3 minutes', lines: ['How AgentGuard works,', '*end to end.*'], sub: 'Policy, simulation, your approval, an onchain cap, and a kill switch.' }) },
    { name: '02-site-hero', width: 1280, height: 720, sel: '.hero' },
    { name: '03-site-how', width: 1280, height: 720, sel: '#how' },
    { name: '04-site-money', width: 1280, height: 720, sel: '.flow-grid', setup: 'launchCaps' },
    { name: '05-site-security', width: 1280, height: 720, sel: '#security' },
    { name: '06-site-approval', width: 1280, height: 720, sel: '.phone' },
    { name: '07-site-chains', width: 1280, height: 720, sel: '#chains' },
    { name: '08-site-developers', width: 1280, height: 720, sel: '#developers' },
    {
      name: '09-risks',
      size: 'h',
      html: c.list({
        kicker: 'Known risks · docs/final-report.md',
        items: [
          ['!', 'Safe chains: a stolen hot key can send the day’s cap to any address'],
          ['!', 'The owner key is in a software wallet. Keep the vault small'],
          ['!', 'The signing page is a trust root. Deploy your own, from protected main'],
          ['!', 'Prompt injection through paid content is limited, not solved'],
        ],
      }),
    },
    { name: '10-cta', size: 'h', html: c.cta({ items: CTA }) },
    { name: 'thumb', size: 'h', html: c.title({ kicker: 'Explainer', lines: ['How an agent pays', '*without a key.*'], xl: true }) },
  ],
  'day-06': [
    { name: '01-hook', html: c.title({ kicker: 'Robinhood Chain mainnet pilot', lines: ['Real money.', 'Real chain.', '*Real kill.*'], xl: true }) },
    {
      name: '02-timeline',
      html: c.list({
        kicker: 'The pilot, 8–9 Nov 2026',
        items: [
          ['1', 'Safe created in Phantom', 'A new wallet with its own recovery phrase, as sole owner.'],
          ['2', 'Funded with 4.91 USDG', 'Allowance set: 5 USDG a day for the hot wallet.'],
          ['3', 'The agent paid 0.50 USDG over x402', 'tx 0xa9c7…3d86'],
          ['4', '/kill paused guard-core', ''],
          ['5', 'The owner’s Phantom kill removed the delegate', 'Every step read back from the chain.'],
        ],
      }),
    },
    {
      name: '03-found',
      html: c.list({
        kicker: 'What the pilot found',
        heading: ['Live runs', '*find real bugs.*'],
        items: [
          ['!', 'The bot on Fly was older than main', 'No Robinhood kill button. The manual kill link worked. Deploys now follow CI on main.'],
          ['!', 'A dead Solana kill button', 'The bot now offers one only for a limit that still exists.'],
        ],
      }),
    },
    { name: '04-site-roadmap', sel: '#roadmap' },
    {
      name: '05-scope',
      html: c.list({
        kicker: 'What a pilot is, and is not',
        items: [
          ['!', 'A pilot at a pilot’s cap', '5 USDG a day, a small Safe.'],
          ['✓', 'Launch cap: 20 a day per chain', 'Raised to 50 only after 2–3 weeks without incidents.'],
          ['!', 'Early software', 'Known risks are listed in docs/final-report.md.'],
        ],
      }),
    },
    { name: '06-cta', html: c.cta({ items: CTA }) },
    { name: 'thumb', html: c.title({ kicker: 'Mainnet pilot', lines: ['0.50 USDG.', '*Then the kill.*'], xl: true }) },
  ],
  'day-07': [
    { name: '01-hook', html: c.title({ kicker: 'Build in public · week 1', lines: ['Week one,', '*in public.*'], xl: true }) },
    {
      name: '02-shipped',
      html: c.list({
        kicker: 'Shipped',
        items: [
          ['✓', 'Repository public, Apache-2.0'],
          ['✓', 'Live on Robinhood Chain mainnet'],
          ['✓', '895 automated tests, 39 attack cases'],
          ['✓', 'Self-host guide, end to end'],
          ['✓', 'MCP server with four tools for agents'],
        ],
      }),
    },
    {
      name: '03-tests',
      html: c.table({
        kicker: 'pnpm test · release branch',
        heading: ['895 tests,', '*all passing.*'],
        rows: [['guard-core', '307'], ['onchain', '218'], ['mcp-server', '168'], ['telegram-bot', '149'], ['e2e', '53'], Object.assign(['Total', '895'], { total: true })],
        sub: 'Source: docs/final-report.md',
      }),
    },
    {
      name: '04-before-caps',
      html: c.list({
        kicker: 'Before caps go from 20 to 50',
        items: [
          ['□', '2–3 weeks on mainnet at the starting cap', 'No unexplained intent, no unexplained alert.'],
          ['□', 'The kill rehearsed on Solana mainnet, timed'],
          ['□', 'A backup schedule off the Fly volume'],
          ['□', 'Hot keys in a KMS, once the cap rises'],
          ['□', 'Base: addresses confirmed and its own pilot'],
        ],
      }),
    },
    { name: '05-cta', html: c.cta({ items: CTA }) },
    { name: 'thumb', html: c.title({ kicker: 'Week 1 recap', lines: ['What shipped.', '*What is still open.*'], xl: true }) },
  ],
}
