# Day 01 · Monday 2026-11-09 · Launch

Theme: AgentGuard is public and live on Robinhood Chain mainnet. Solana is next.
Links: repository `https://github.com/agent443-dot/AgentGuard/tree/main` (use `/tree/main` until the
default branch is switched to `main`).

---

## 13:00 UTC · 10:00 BRT · Announcement thread (pin it) · P1

**1/8** · Image: `assets/day-01/01-launch.png`

```text
Your AI agent can pay for things now. It still never touches a private key.

AgentGuard is public: an open-source guard between agents and money. Policy, simulation, your approval on Telegram, and a daily cap enforced onchain.

Live on Robinhood Chain mainnet. 🧵
```

Alt text: Dark card with the AgentGuard gradient bar. Headline: "Your agent can spend. It never holds
the key." Below: "AgentGuard sits between AI agents and money: policy, simulation, your approval on
Telegram, and a daily cap enforced onchain. Self-hosted, Apache-2.0."

**2/8**

```text
The problem: an agent that can pay needs a key, and an agent with a key can be talked into anything.

AgentGuard splits the two. The agent asks to pay through MCP. guard-core decides, and only guard-core signs.
```

**3/8** · Image: `assets/day-01/02-money-flow.png`

```text
Where the money lives:

Your vault (a Safe, or a Squads multisig on Solana) belongs to your own Phantom wallet.

An onchain daily cap lets a small hot wallet draw from it. The hot wallet's key is held only by guard-core.
```

Alt text: Diagram of three stacked boxes. "Your vault: Safe or Squads multisig, only your Phantom wallet
controls it." Arrow: "onchain daily cap, Safe Allowance Module or Squads Spending Limit." "Guard hot
wallet: small balance, key held only by guard-core." Arrow: "policy, simulation, your approval on
Telegram above a threshold." "x402 APIs and transfers: only recipients and domains you allowed."

**4/8**

```text
Every payment goes through:

1. A deny-all policy per agent: per-payment and daily limits, allowed chains, tokens, recipients, domains
2. A simulation of the exact transfer
3. Your approval on Telegram above your threshold

Approvals expire and are redeemed once.
```

**5/8** · Image: `assets/day-01/03-worst-case.png`

```text
The worst case, in writing:

The most a day can cost is the daily cap plus what sits in the hot wallet. That holds even if guard-core is compromised, because the cap is enforced by Squads or the Safe Allowance Module.

We wrote no contract of our own.
```

Alt text: Card titled "Worst case, in writing". Large gradient text: "Most a day can cost: cap + hot
wallet". Below: "Even if guard-core is compromised. The cap is enforced by Squads or the Safe Allowance
Module, not by our code. No custom contract."

**6/8**

```text
Something wrong? /kill in Telegram pauses every agent. One Phantom signature then removes the onchain cap.

We ran it with real money on Robinhood Chain mainnet: a 0.50 USDG x402 payment, then the kill. Each result was read back from the chain.
```

**7/8**

```text
What is early, plainly:

• Launch caps: 20 a day per chain
• Solana mainnet is next, Base after it
• No hosted service: you run your own guard, bot and signing page
• 7 known risks are listed in the final report, with what is still open
```

**8/8**

```text
What makes it different: no key in the agent, no contract of ours, a loss bound enforced onchain, and a real-money mainnet pilot. Plus 895 tests and 39 attack cases.

Apache-2.0. Read it, run it, try to break it.

https://github.com/agent443-dot/AgentGuard/tree/main
```

---

## 13:45 UTC · 10:45 BRT · Video · P1

Quote-post the pinned thread.

```text
[VIDEO DAY 01]

AgentGuard in one minute: what sits between your agent and your money, and what happens when you press /kill.
```

Caption for the video session: "What AgentGuard is, and the four things between an agent and a payment."
Alt text / captions: provided with the video; add burned-in subtitles, since most people watch muted.

---

## 16:00 UTC · 13:00 BRT · Build in public · P2

Image: `assets/day-01/06-tests.png`

```text
Release-day check, real output from `pnpm test`:

guard-core 307
onchain 218
mcp-server 168
telegram-bot 149
e2e 53

895 passing. CI also runs the Foundry fork tests and the signing page in a real Chromium.
```

Alt text: Terminal-style card titled "895 tests. All passing." It lists per-package results from pnpm
test: guard-core 307 passed, onchain 218, mcp-server 168, telegram-bot 149, e2e 53. Below: "The attack
suite: 39 cases, 24 on Solana and 15 on EVM. CI also runs Foundry fork tests and the signing page in a
real Chromium."

---

## 18:00 UTC · 15:00 BRT · Visual: the pilot · P2

Image: `assets/day-01/04-pilot.png`

```text
Before going public we ran it with real money on Robinhood Chain mainnet:

• a Safe owned by a fresh Phantom wallet
• a 5 USDG daily allowance for the hot wallet
• a 0.50 USDG x402 payment
• /kill, then Phantom removed the delegate

All read back from the chain.
```

Alt text: Card titled "One payment, then the kill. Read back from the chain." Rows: Safe, owner a new
Phantom wallet alone, threshold 1. Allowance, 5 USDG per day for the hot wallet. x402 payment, 0.50
USDG, transaction 0xa9c7abff…78083d86. After, Safe 4.914759 to 4.414759 USDG, hot wallet 0. Kill,
/kill paused the agent and Phantom removed the delegate.

Reply to self, with the link:

```text
The full pilot log, with the transaction and what each step read back:
https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md
```

---

## 20:30 UTC · 17:30 BRT · Engagement · P5

```text
Question for people building agents that pay:

What should an agent never be able to pay for, no matter what the prompt says?

We start every agent at deny-all and make you allow each domain and recipient. Curious where you draw the line.
```

---

## 22:30 UTC · 19:30 BRT · Reply sweep

No new post. Answer every real question on the thread by hand. If there were replies, close with a
reply to the pinned thread:

```text
Thanks to everyone who read the code today and asked hard questions. Keep them coming: the known risks and open items are all in the repo, and we would rather hear about a hole now than later.
```

---

## Reply bank for Day 1

**"Is it audited?"**

```text
AgentGuard itself has had no third-party audit. The onchain cap uses Squads v4 and the Safe Allowance Module, which are audited, and we added no contract. Our own pre-release review and its fixes are in docs/security-review.md.
```

**"What if your server gets hacked?"**

```text
It is your server: there is no hosted service. If your guard-core is compromised, the most a day can cost is the daily cap plus the hot wallet balance, because the cap is enforced onchain. Then /kill and one Phantom signature remove the cap.
```

**"Why a software wallet as owner?"**

```text
Fair point, it is known risk #2. The owner wallet can move the whole vault, so the rule is: a fresh Phantom wallet with its own phrase, used for nothing else, and a vault that holds only what agents need for the next few days.
```

**"Which agents does it work with?"**

```text
Anything that speaks MCP. The README has setups for Claude Desktop and Claude Code, and the shape for any stdio or HTTP client. Four tools: paid_fetch, transfer, get_budget, check_intent.
```

**"Is Solana live?"** (until the owner confirms)

```text
Not yet. Robinhood Chain is live today. Solana is next: it ran end to end on devnet with real Telegram and Phantom, and the cap is tested against the real Squads program. Base comes after.
```

**"Is there a token?"**

```text
No. AgentGuard is open-source software. There is nothing to buy.
```

**"Can I use it without crypto knowledge?"**

```text
Honestly, not yet comfortably. Self-hosting means Fly, Vercel, a Telegram bot and a Phantom wallet. docs/self-host.md walks through it in order, but it is a developer setup today.
```

**"I found a bug / a vulnerability"**

```text
Thank you. If it could move funds, bypass a policy or expose a key, please report it privately: Security → Report a vulnerability on the repo. You get an answer within 72 hours. Anything else, a public issue is great.
```
