/* global module */
// Visuals for days 8–30. Same rules as cards.cjs: every figure comes from the source files.
const rows = (items, extra = '') =>
  `<div class="rows ${extra}">${items
    .map(([k, v, tone]) => `<div class="row ${tone || ''}"><b>${k}</b><span>${v}</span></div>`)
    .join('')}</div>`
const title = (a, b) => `<h1 class="small">${a}${b ? ` <span class="grad">${b}</span>` : ''}</h1>`
const body = (t) => `<p class="body">${t}</p>`
const code = (t, style = '') => `<pre style="${style}">${t}</pre>`
const steps = (items) =>
  `<div class="flow">${items
    .map((s) =>
      s.arrow
        ? `<div class="arrow">${s.arrow}</div>`
        : `<div class="box"><strong>${s[0]}</strong><em>${s[1]}</em></div>`,
    )
    .join('')}</div>`

module.exports = [
  {
    out: 'day-08/01-self-host.png',
    eyebrow: 'docs/self-host.md · what you need',
    html:
      title('Run your own.', 'Nothing in the path belongs to us.') +
      rows([
        ['Runtime', 'Node 20+ and pnpm 10 (WSL2 on Windows)'],
        ['guard + bot', 'a Fly.io account with a card on it'],
        ['Signing page', 'Vercel, or any static host with custom headers'],
        ['Owner', 'a new Phantom wallet, used for nothing else'],
        ['Approvals', 'Telegram, and a bot token from @BotFather'],
      ]),
  },
  {
    out: 'day-09/01-x402-flow.png',
    eyebrow: 'paid_fetch · x402, step by step',
    html:
      title('An API asks for payment.', 'The guard decides.') +
      steps([
        ['1 · Request', 'guard-core fetches the URL for the agent'],
        { arrow: '402 Payment Required: network, asset, payTo, amount' },
        ['2 · Policy + simulation', 'domain allowlist, limits, the exact transfer'],
        { arrow: 'above your threshold: Telegram first' },
        ['3 · Sign and retry', 'the 402 terms must equal the approved intent'],
        { arrow: 'the paid response returns to the agent, marked as data' },
      ]),
  },
  {
    out: 'day-09/02-untrusted.png',
    eyebrow: 'Known risk #7 · prompt injection',
    html:
      title('Paid content is data,', 'not instructions.') +
      rows([
        ['Marked', 'paid_fetch fences the response as untrusted third-party data'],
        ['Still bound', 'every payment meets the policy and, above the threshold, you'],
        ['Ignored text', "the agent's reason is shown to you, never used to decide"],
        ['Not solved', 'a model that ignores the marking can still ask to pay', 'warn'],
      ]),
  },
  {
    out: 'day-10/01-review.png',
    eyebrow: 'Pre-release review · 2026-11-09',
    html:
      title('Two high, six medium.', 'All fixed with tests.') +
      rows(
        [
          ['high', 'Solana kill page trusted the hot wallet in its link', 'bad'],
          ['high', 'a pause did not reach a payment already waiting', 'bad'],
          ['medium', '"spending limit: none" printed for any read error', 'warn'],
          ['medium', 'x402 over plain http to an allowlisted host', 'warn'],
          ['medium', 'an RPC key in a URL could reach the logs', 'warn'],
          ['+3 medium', 'kill prompt edits, settlement ids, refused terms', 'warn'],
        ],
        'tight',
      ),
  },
  {
    out: 'day-11/01-no-contract.png',
    eyebrow: 'The onchain layer',
    html:
      title('We wrote no contract.', 'On purpose.') +
      rows([
        ['Solana', 'Squads v4 multisig + Spending Limit'],
        ['Robinhood Chain', 'Safe + Safe Allowance Module 0.1.1'],
        ['Base (later)', 'Safe + Safe Allowance Module 0.1.1'],
      ]) +
      body(
        'Widely used, independently audited, already live. Our code decides what to pay; theirs caps how much.',
      ),
  },
  {
    out: 'day-11/02-usdg.png',
    eyebrow: 'Robinhood Chain · check the address, not the name',
    note: 'docs/self-host.md, step 4',
    html:
      title('Other tokens share the name.', 'Check the address.') +
      code(
        'USDG on Robinhood Chain (eip155:4663)\n<span class="ok">0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168</span>',
      ) +
      body(
        'guard-core and the scripts also check every configured address against the chain: it must hold code, and the dollar must report 6 decimals.',
      ),
  },
  {
    out: 'day-12/01-signing-page.png',
    eyebrow: 'Known risk #3 · ADR 003',
    html:
      title('The signing page', 'is a trust root.') +
      rows([
        ['Why', 'whoever redeploys it can show a harmless summary of a harmful tx', 'warn'],
        ['Yours', 'each user deploys their own, from their own protected main'],
        ['Locked', 'builds main only, previews off, strict Content-Security-Policy'],
        ['Fixed', 'your hot wallet addresses are built in; a link cannot change them'],
        ['Checked', 'each result is read back from the chain'],
      ]),
  },
  {
    out: 'day-13/01-policy.png',
    eyebrow: 'PUT /v1/admin/policy/:agentId · example',
    note: 'Amounts in base units (6 decimals) · example values',
    html:
      title('Deny-all,', 'until you write this.') +
      code(
        `{
  "chains": ["eip155:4663"],
  "tokens": ["0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"],
  "perTxMax": <span class="ok">"5000000"</span>,          <span class="dim">// 5 per payment</span>
  "dailyMax": <span class="ok">"20000000"</span>,         <span class="dim">// 20 a day</span>
  "approvalThreshold": <span class="ok">"1000000"</span>, <span class="dim">// ask me from 1 up</span>
  "allowedRecipients": [],
  "allowedDomains": ["api.example.com"],
  "paused": false
}`,
        'font-size:19px;line-height:1.45;padding:18px 24px',
      ),
  },
  {
    out: 'day-14/01-week-2.png',
    eyebrow: 'Week 2 · what we covered',
    html:
      title('Week two,', 'plainly.') +
      rows([
        ['Self-hosting', 'what you need, in order'],
        ['x402', 'paid content is data; prompt injection limited, not solved'],
        ['Review', 'two high and six medium findings, fixed with tests'],
        ['Onchain', 'no custom contract; check the token address'],
        ['Trust root', 'deploy your own signing page'],
      ]),
  },
  {
    out: 'day-15/01-attacks.png',
    eyebrow: 'Attack suite · 24 Solana cases, 15 EVM cases',
    html:
      title('What gets thrown at it.', 'And refused.') +
      rows([
        ['EVM', 'approve, Permit / Permit2, EIP-7702 delegation'],
        ['Solana', 'SPL Approve, SetAuthority, CloseAccount'],
        ['Solana', 'unknown programs, hidden lookup-table accounts'],
        ['x402 (e2e)', 'a payTo moved on the retry'],
        ['bot (e2e)', 'bad HMAC, replayed webhook, a stranger pressing Approve'],
      ]),
  },
  {
    out: 'day-16/01-bigint.png',
    eyebrow: 'SPEC.md · amounts',
    html:
      title('No floats for money.', 'Ever.') +
      code(`<span class="dim">agent sends</span>   amountUsd: <span class="ok">"0.25"</span>          <span class="dim">// a decimal string</span>
<span class="dim">guard stores</span>  amount:    <span class="ok">"250000"</span>        <span class="dim">// atomic units, bigint</span>

<span class="dim">refused, never rounded:</span>
  <span class="warn">0.25</span> (a JSON number)  <span class="warn">"-1"</span>  <span class="warn">"1e3"</span>  <span class="warn">"NaN"</span>  <span class="warn">"0.1234567"</span>`) +
      body(
        'Every decision goes to the audit log with its reasons, exact to a millionth of a dollar.',
      ),
  },
  {
    out: 'day-17/01-approval-scope.png',
    eyebrow: 'One yes, one payment',
    html:
      title('What your approval covers.', 'Exactly.') +
      rows([
        ['Terms', 'this chain, token, amount, recipient and domain'],
        ['Once', 'redeemed a single time, then spent'],
        ['10 minutes', 'unanswered or unredeemed: APPROVAL_TIMEOUT'],
        ['Owners only', 'a stranger pressing Approve is refused'],
      ]),
  },
  {
    out: 'day-18/01-open-findings.png',
    eyebrow: 'docs/security-review.md · open, low',
    html:
      title('Still open.', 'None moves money past the policy.') +
      rows(
        [
          ['x402', 'the allowlist matches the host name, not the port', 'warn'],
          ['x402', 'a repeated request before you answer opens a second approval', 'warn'],
          ['x402', 'a paid response over 1 MB is marked failed after paying', 'warn'],
          ['bot', 'replay memory is lost on a restart (hooks are private)', 'warn'],
          ['bot', '/status with 25+ pending approvals is too long for Telegram', 'warn'],
          ['Solana', 'the kill page trusts the multisig from the link', 'warn'],
          ['Solana', 'token-account rent payer not checked (~0.002 SOL)', 'warn'],
        ],
        'tight',
      ),
  },
  {
    out: 'day-19/01-bot.png',
    eyebrow: 'telegram-bot · who it listens to',
    html:
      title('The bot only listens', 'to you.') +
      rows([
        ['Owners', 'updates ignored unless the sender is in OWNER_TELEGRAM_IDS'],
        ['Hooks', 'HMAC-SHA256 over the raw bytes, checked before parsing'],
        ['Replays', 'stale (5 min+) and duplicate events refused'],
        ['Network', 'no public IP: long polling, hooks over the private network'],
        ['Kill buttons', 'expire; offered only for a limit that still exists'],
      ]),
  },
  {
    out: 'day-20/01-pending.png',
    eyebrow: 'For agent builders · pending_approval',
    html:
      title('While the owner decides,', 'the agent waits.') +
      rows([
        ['pending', 'tell the user; poll check_intent every 15–30 s; never repeat the payment'],
        ['approved', 'paid_fetch: repeat exactly the same request, once'],
        ['executed', 'done: the result has the transaction id'],
        ['rejected', 'the owner said no: do not retry', 'bad'],
        ['expired', 'no answer in time: nothing moved', 'warn'],
      ]),
  },
  {
    out: 'day-21/01-caps.png',
    eyebrow: 'docs/final-report.md · before raising caps',
    html:
      title('20 a day, until', 'every box is checked.') +
      rows([
        ['☐', '2–3 weeks on mainnet, no unexplained intent, no unexplained alert'],
        ['☐', 'the kill rehearsed and timed on Solana mainnet'],
        ['☐', 'a backup schedule off the Fly volume'],
        ['☐', 'hot keys in a KMS, once the cap rises'],
        ['☐', 'Base: addresses confirmed live, and its own pilot'],
      ]),
  },
  {
    out: 'day-22/01-restore.png',
    eyebrow: 'Restore drill · 2026-11-09',
    html:
      title('A backup only counts', 'once you restore it.') +
      steps([
        ['1 · db:backup on the machine', 'a 72 KB file'],
        { arrow: 'fly ssh sftp get → the owner machine, mode 0600' },
        ['2 · restore-drill', 'opened with the current code and migrations'],
        { arrow: 'compared with the live guard' },
        ['3 · All matched', "policy, today's spend, both executed intents, all 15 audit events"],
      ]),
  },
  {
    out: 'day-23/01-rate-limit.png',
    eyebrow: 'Deployment review · behind Fly’s proxy',
    html:
      title('130 requests, forged client IPs.', 'Still 429.') +
      rows([
        ['Test', 'about a minute, each with a different Fly-Client-IP and X-Forwarded-For'],
        ['Result', 'still rate limited: Fly replaces the header with the real address'],
        ['Rule', 'guard-core counts per socket address, never X-Forwarded-For'],
        ['Risk #4', 'behind your own proxy, add a per-client limit there', 'warn'],
      ]),
  },
  {
    out: 'day-24/01-owner-key.png',
    eyebrow: 'Known risk #2 · a software wallet owner',
    html:
      title('Three conditions.', 'All mandatory.') +
      rows([
        ['1 · Fresh phrase', 'a recovery phrase created for the owner account alone'],
        ['2 · One job', 'no dapps, no other tokens, no signing anything else'],
        ['3 · Small vault', 'only what agents need for the coming days'],
      ]) +
      body(
        'A stolen owner key reaches the whole vault, not just the daily cap. That is why the vault stays small.',
      ),
  },
  {
    out: 'day-25/01-life.png',
    eyebrow: 'Mainnet pilot · intent 9a594294',
    html:
      title('The life of one payment.', '0.50 USDG.') +
      steps([
        ['Request', 'paid_fetch to the one allowed domain'],
        { arrow: 'policy: chain 4663, USDG, ≤ 1 per payment, ≤ 5 a day' },
        ['Auto-approved', 'under the threshold'],
        { arrow: 'EIP-3009 authorization, signed by the hot wallet only' },
        ['Settled', 'tx 0xa9c7abff…78083d86 · allowance 500000 spent'],
      ]),
  },
  {
    out: 'day-26/01-report.png',
    eyebrow: 'SECURITY.md',
    html:
      title('Found a hole?', 'Tell us privately.') +
      rows([
        ['Where', 'Security → Report a vulnerability, on the repository'],
        ['Answer', 'within 72 hours'],
        ['Disclosure', '90 days, or until a fix ships if sooner'],
        ['Credit', 'in the fix’s release notes, if you want it'],
        ['Bounty', 'no paid bounty yet', 'warn'],
      ]),
  },
  {
    out: 'day-27/01-base.png',
    eyebrow: 'Base · where it stands',
    html:
      title('Base: tested,', 'not live.') +
      rows([
        ['Done', 'full stack on Base Sepolia, including from an empty hot wallet'],
        ['Done', 'cap and kill proven on a Base mainnet fork, official module'],
        ['Open', 'the Base mainnet addresses confirmed live (CR-005)', 'warn'],
        ['Open', 'the Base hot key read from a file, as on Solana', 'warn'],
        ['Open', 'its own real-money pilot, as Robinhood Chain had', 'warn'],
      ]),
  },
  {
    out: 'day-28/01-week-4.png',
    eyebrow: 'Week 4 · what we covered',
    html:
      title('Week four,', 'plainly.') +
      rows([
        ['Backups', 'a restore drill, checked against the live guard'],
        ['Rate limits', 'forged client IPs, still limited'],
        ['Owner key', 'three conditions for a software wallet'],
        ['One payment', 'the pilot intent, end to end'],
        ['Base', 'tested on Sepolia; what is left'],
      ]),
  },
  {
    out: 'day-29/01-steps.png',
    eyebrow: 'docs/self-host.md · the order',
    html:
      title('From clone', 'to a first paid call.') +
      rows(
        [
          ['1', 'clone, pnpm install, pnpm check'],
          ['2', 'keys: owner in Phantom, a hot wallet per chain, service tokens'],
          ['3', 'your signing page on Vercel'],
          ['4', 'your vault and its daily cap, read back'],
          ['5', 'guard-core and the bot on Fly'],
          ['6', 'an agent, its policy, an MCP client'],
          ['7', 'a small payment, a kill and a restore, once'],
        ],
        'tight',
      ),
  },
  {
    out: 'day-30/01-thirty.png',
    eyebrow: '30 days in the open',
    html:
      title('Thirty days.', 'Same promise.') +
      body(
        'The most a day can cost is the daily cap plus what sits in the hot wallet, even if guard-core is compromised. The agent never holds a key.',
      ) +
      rows([
        ['Read', 'the code, the risks and the review: all in the repo'],
        ['Run', 'your own guard, bot and signing page'],
        ['Report', 'privately, through the Security tab'],
      ]),
  },
]
