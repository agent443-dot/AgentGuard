/* global module */
// One entry per image. `html` fills the card body; `selector` instead screenshots that site section.
// Every figure here comes from README.md, docs/final-report.md or docs/security-review.md.
const flow = `
<div class="flow">
  <div class="box"><strong>Your vault</strong><em>Safe or Squads multisig · only your Phantom wallet controls it</em></div>
  <div class="arrow">onchain daily cap · Safe Allowance Module / Squads Spending Limit</div>
  <div class="box"><strong>Guard hot wallet</strong><em>small balance · key held only by guard-core</em></div>
  <div class="arrow">policy → simulation → your approval on Telegram above a threshold</div>
  <div class="box"><strong>x402 APIs and transfers</strong><em>only recipients and domains you allowed</em></div>
</div>`

module.exports = [
  // Profile header, 1500x500 on X: rendered as its own size below.
  {
    out: 'profile/header.png',
    size: { width: 1500, height: 500 },
    eyebrow: 'Open source · self-hosted · Apache-2.0',
    html: `<h1 class="small" style="font-size:58px">Your agent can spend.<br/><span class="grad">It never holds the key.</span></h1>
<p class="body" style="font-size:22px;margin-top:16px">Policy · simulation · Telegram approval · onchain daily cap</p>`,
  },
  // Day 01: launch
  {
    out: 'day-01/01-launch.png',
    eyebrow: 'Open source · Live on Robinhood Chain mainnet',
    html: `<h1>Your agent can spend.<br/><span class="grad">It never holds the key.</span></h1>
<p class="body">AgentGuard sits between AI agents and money: policy, simulation, your approval on Telegram, and a daily cap enforced onchain. Self-hosted, Apache-2.0.</p>`,
  },
  {
    out: 'day-01/02-money-flow.png',
    eyebrow: 'How the money is protected',
    html: `<h1 class="small">Funds stay in your vault.<br/><span class="grad">The agent spends from a capped wallet.</span></h1>${flow}`,
  },
  {
    out: 'day-01/03-worst-case.png',
    eyebrow: 'Worst case, in writing',
    html: `<h1 class="small">Most a day can cost:</h1>
<div class="big"><span class="grad">cap + hot wallet</span></div>
<p class="body">Even if guard-core is compromised. The cap is enforced by Squads or the Safe Allowance Module, not by our code. No custom contract.</p>`,
  },
  {
    out: 'day-01/04-pilot.png',
    eyebrow: 'Real-money pilot · Robinhood Chain mainnet (4663)',
    note: 'Source: docs/security-review.md · HUMAN-21',
    html: `<h1 class="small">One payment, then the kill. <span class="grad">Read back from the chain.</span></h1>
<div class="rows">
  <div class="row"><b>Safe</b><span>owner: a new Phantom wallet, alone · threshold 1</span></div>
  <div class="row"><b>Allowance</b><span>5 USDG per day for the hot wallet</span></div>
  <div class="row"><b>x402 payment</b><span>0.50 USDG · tx 0xa9c7abff…78083d86</span></div>
  <div class="row"><b>After</b><span>Safe 4.914759 → 4.414759 USDG · hot wallet 0</span></div>
  <div class="row bad"><b>Kill</b><span>/kill paused the agent · Phantom removed the delegate</span></div>
</div>`,
  },
  { out: 'day-01/05-site-money.png', selector: 'section:has-text("Where the money lives")' },

  // Day 02: Solana
  {
    out: 'day-02/01-solana-next.png',
    eyebrow: 'Chains · status',
    html: `<h1>Robinhood Chain: <span class="grad">live.</span><br/>Solana: next.<br/>Base: later.</h1>
<p class="body">Solana runs on a Squads v4 Spending Limit. Proven on devnet with real Telegram and Phantom, and in automated tests against the real Squads program.</p>`,
  },
  {
    out: 'day-02/02-solana-live.png',
    eyebrow: 'Chains · status',
    html: `<h1>Solana mainnet: <span class="grad">live.</span></h1>
<p class="body">Same guard, same policy, same kill. The daily cap is a Squads v4 Spending Limit with the hot wallet as its only member and only destination. Launch cap: 20 a day.</p>`,
  },
  {
    out: 'day-02/03-two-mechanisms.png',
    eyebrow: 'Same promise, two mechanisms',
    html: `<h1 class="small">The loss bound is the same.<br/><span class="grad">The path is not.</span></h1>
<div class="rows">
  <div class="row"><b>Solana</b><span>Squads Spending Limit: the cap can only move into the hot wallet</span></div>
  <div class="row warn"><b>Safe chains</b><span>Allowance Module: the delegate can send the cap to any address</span></div>
  <div class="row"><b>Both</b><span>worst day = daily cap + hot wallet balance</span></div>
</div>
<p class="body">A stolen hot key on a Safe chain can send the day's cap anywhere without guard-core seeing it. Known risk #1 in our final report.</p>`,
  },

  {
    out: 'day-01/06-tests.png',
    eyebrow: 'pnpm test · release branch, 2026-11-09',
    note: 'Real output, trimmed to the summary lines',
    html: `<h1 class="small">895 tests. <span class="grad">All passing.</span></h1>
<pre><span class="dim">packages/guard-core   test:</span>  Tests  <span class="ok">307 passed</span> (307)
<span class="dim">packages/onchain      test:</span>  Tests  <span class="ok">218 passed</span> (218)
<span class="dim">packages/mcp-server   test:</span>  Tests  <span class="ok">168 passed</span> (168)
<span class="dim">packages/telegram-bot test:</span>  Tests  <span class="ok">149 passed</span> (149)
<span class="dim">e2e                   test:</span>  Tests  <span class="ok">53 passed</span> (53)</pre>
<p class="body">The attack suite: 39 cases, 24 on Solana and 15 on EVM. CI also runs Foundry fork tests and the signing page in a real Chromium.</p>`,
  },

  // Day 03: MCP
  {
    out: 'day-03/01-mcp-connect.png',
    eyebrow: 'For agent builders · Claude Code over stdio',
    note: 'packages/mcp-server/README.md · placeholders, not real values',
    html: `<h1 class="small">Connect an agent. <span class="grad">It gets tools, not keys.</span></h1>
<pre><span class="dim">$</span> claude mcp add agentguard \\
    -e GUARD_URL=http://localhost:8787 \\
    -e AGENT_ID=my-agent -e AGENT_TOKEN=<span class="warn">&lt;agent token&gt;</span> \\
    -- /path/to/AgentGuard/packages/mcp-server/node_modules/.bin/tsx \\
       /path/to/AgentGuard/packages/mcp-server/src/main.ts</pre>`,
  },
  {
    out: 'day-03/02-four-tools.png',
    eyebrow: 'MCP server · four tools',
    html: `<h1 class="small">Everything your agent can do with money.</h1>
<div class="rows">
  <div class="row"><b>paid_fetch</b><span>pay for an HTTP resource that asks for x402</span></div>
  <div class="row"><b>transfer</b><span>send dollars to an allowed address</span></div>
  <div class="row"><b>get_budget</b><span>read today's spend and its limits</span></div>
  <div class="row"><b>check_intent</b><span>follow a payment through owner approval</span></div>
</div>
<p class="body">No tool returns a key. No tool changes a limit.</p>`,
  },

  // Day 04: simulation and reject codes
  {
    out: 'day-04/01-reject-codes.png',
    eyebrow: 'What gets blocked · from SPEC.md',
    html: `<h1 class="small">Twenty ways to say no. <span class="grad">Each one has a name.</span></h1>
<pre><span class="dim">shared</span>  PAUSED  CHAIN_NOT_ALLOWED  TOKEN_NOT_ALLOWED
        RECIPIENT_NOT_ALLOWED  DOMAIN_NOT_ALLOWED
        PER_TX_EXCEEDED  DAILY_EXCEEDED  SIM_FAILED
        SIM_UNEXPECTED_EFFECT  OWNER_REJECTED
        APPROVAL_TIMEOUT  INVALID_402
<span class="dim">evm</span>     APPROVAL_DETECTED  PERMIT_DETECTED  DELEGATION_DETECTED
<span class="dim">solana</span>  DELEGATE_DETECTED  AUTHORITY_CHANGE_DETECTED
        ACCOUNT_CLOSE_DETECTED  UNKNOWN_PROGRAM_DETECTED
        HIDDEN_ACCOUNTS_DETECTED</pre>`,
  },
  { out: 'day-04/02-site-threats.png', selector: 'section:has-text("Twenty ways to say no")' },

  // Day 05: Telegram approvals and a credited bug
  { out: 'day-05/01-site-telegram.png', selector: 'section:has-text("Big payments wait for")' },
  {
    out: 'day-05/02-bug-63.png',
    eyebrow: 'Found in a live run · fixed in #63',
    html: `<h1 class="small">An empty hot wallet <span class="grad">could never pay.</span></h1>
<div class="rows">
  <div class="row bad"><b>What happened</b><span>first payment from an empty hot wallet on Base Sepolia: SIM_FAILED</span></div>
  <div class="row warn"><b>Why</b><span>the simulation ran before the top-up from the vault</span></div>
  <div class="row"><b>Fix</b><span>top up first, then simulate the exact transfer · reason now logged (#62)</span></div>
  <div class="row"><b>Re-checked</b><span>live on Solana devnet, from a hot wallet with no token account at all</span></div>
</div>`,
  },

  // Day 06: kill switch
  {
    out: 'day-06/01-kill.png',
    eyebrow: 'The kill · as run in the mainnet pilot',
    html: `<h1 class="small">/kill, then <span class="grad">one Phantom signature.</span></h1>
<div class="flow">
  <div class="box"><strong>1 · /kill → Confirm in Telegram</strong><em>guard-core pauses every agent</em></div>
  <div class="arrow">the bot drafts the owner transaction for each chain</div>
  <div class="box"><strong>2 · Sign in Phantom</strong><em>on the signing page you deploy yourself</em></div>
  <div class="arrow">Safe: removeDelegate(hot, true) · Squads: remove the spending limit</div>
  <div class="box"><strong>3 · Read it back</strong><em>"no longer a delegate" · /status shows no limit</em></div>
</div>`,
  },

  // Day 07: known risks and recap
  {
    out: 'day-07/01-known-risks.png',
    eyebrow: 'docs/final-report.md · Known risks',
    html: `<h1 class="small">Seven known risks. <span class="grad">Written down, not hidden.</span></h1>
<div class="rows tight" style="gap:8px;margin-top:22px">
  <div class="row warn"><b>1 · Safe chains</b><span>a stolen hot key can send the day's cap anywhere</span></div>
  <div class="row warn"><b>2 · Owner key</b><span>in a software wallet: keep the vault small</span></div>
  <div class="row warn"><b>3 · Signing page</b><span>a trust root: deploy your own, from your own main</span></div>
  <div class="row warn"><b>4 · Rate limits</b><span>per socket address: a proxy needs its own limit</span></div>
  <div class="row warn"><b>5 · One process</b><span>SQLite, in-memory limits; off-volume backups still open</span></div>
  <div class="row warn"><b>6 · Lockfile</b><span>one high advisory, not reachable from runtime</span></div>
  <div class="row warn"><b>7 · Prompt injection</b><span>limited by policy, not solved</span></div>
</div>`,
  },
  {
    out: 'day-07/02-week-1.png',
    eyebrow: 'Week 1 · what shipped',
    html: `<h1 class="small">Week one, <span class="grad">plainly.</span></h1>
<div class="rows">
  <div class="row"><b>Live</b><span>Robinhood Chain mainnet, launch cap 20 a day</span></div>
  <div class="row"><b>Open</b><span>Apache-2.0, self-hosted, no hosted service</span></div>
  <div class="row"><b>Tested</b><span>895 automated tests · 39 attack cases</span></div>
  <div class="row warn"><b>Next</b><span>Solana mainnet · then Base</span></div>
  <div class="row warn"><b>Before caps rise</b><span>2–3 clean weeks, a timed kill, off-volume backups, KMS</span></div>
</div>`,
  },
]
