# Public beta launch (v0.1.0-beta), 2026-11-09

Copy each block and paste it into X. Checked against GitHub: the `v0.1.0-beta` tag, the README's
"Install the beta" section and a full test run at the tag (1,294 passing).

Order: post the thread and pin it. Two to three hours later, post the short post as a quote of the
thread.

The whitepaper link points to `docs/whitepaper.md` on `main`. Do not post that reply until the file
is there.

---

## Thread (9 posts)

### 1/9

```text
AgentGuard v0.1.0-beta is out.

A payment firewall for AI agents: your agent can pay for things, and it never holds the key.

Live with real money on Robinhood Chain and Solana mainnet. Open source, self-hosted. 🧵
```

### 2/9

```text
AgentGuard is not another agent. It protects the ones you already run: Claude Code, Claude Desktop, Cursor, any MCP client.

The agent can only ask to pay. AgentGuard checks, decides and signs. One setup command connects your client.
```

### 3/9

```text
Every payment passes three gates:

1. your policy: per-payment and daily limits, allowed chains, tokens, recipients and websites
2. a simulation of the exact transfer
3. your approval on Telegram above your threshold

Any doubt means no.
```

### 4/9

```text
Under the gates, a hard ceiling: an onchain daily cap, with no custom contract. Squads v4 on Solana, the Safe Allowance Module on Robinhood Chain.

The worst day is the cap plus the hot wallet balance, even if AgentGuard itself is compromised.
```

### 5/9

```text
New in the beta:

• pinned payees: a new recipient, or more than 2x the last price, waits for you
• a circuit breaker for runaway loops
• task budgets for one job at a time
• shadow mode: new agents pay nothing until you switch them live
```

### 6/9

```text
You stay in control from your phone:

• /kill, then one Phantom signature per chain
• /report, /doctor, /agent, /policy and /mode in Telegram
• a public proof-of-cap page: anyone can read the most an agent can draw, straight from the chain
```

### 7/9

```text
Built in, off until you configure them:

• signed receipts for every executed payment
• passkey approvals above an amount you set: a stolen Telegram account can reject a payment, never approve it
```

### 8/9

```text
Plainly: this is a beta.

It has had internal security reviews, but no external audit yet. Only Squads and Safe, the parts it is built on, are audited.

Use small amounts. The default cap is 20 a day, and the signing page refuses more than 50.
```

### 9/9

```text
1,294 automated tests. Apache-2.0. Your own copy, your own vault, your own Phantom wallet. No hosted service.

A setup wizard does the rest, with --dry-run to see every step first.

Release: https://github.com/agent443-dot/AgentGuard/releases/tag/v0.1.0-beta
```

Reply to 9/9 with the install and whitepaper links (post only once docs/whitepaper.md is on main):

```text
Install the beta (Portuguese guide in docs/self-host.pt-BR.md):
https://github.com/agent443-dot/AgentGuard#install-the-beta

Technical whitepaper:
https://github.com/agent443-dot/AgentGuard/blob/main/docs/whitepaper.md
```

---

## Short post (2 to 3 hours later, quoting the thread)

```text
If your agent can spend money, it should not hold the key.

AgentGuard v0.1.0-beta: policy, simulation, Telegram approval and an onchain daily cap, for any MCP agent. Live on Robinhood Chain and Solana. Beta, small amounts, no external audit yet.
```

---

## Prepared replies for today

**"Is it audited?"**

```text
Not externally, not yet. It has had internal security reviews, and the onchain cap uses Squads v4 and the Safe Allowance Module, which are audited. We wrote no contract of our own. That is why it is a beta and we say: small amounts.
```

**"Can I npm install it?"**

```text
Not yet: the packages aren't on npm. Clone the repo, pnpm install, then run the wizard: pnpm --filter create-agentguard start (add --dry-run to see every step first).
```

**"Base?"**

```text
Not live. Base comes next, after its own checks and its own pilot, as Robinhood Chain and Solana had.
```

**"How many users?"**

```text
It's self-hosted, so we can't see who runs it, by design. We won't post numbers we can't back.
```
