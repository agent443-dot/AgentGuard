# Day 15 · Monday 2026-11-23 · The attack suite

Theme: what the 39 attack cases throw at AgentGuard.
Link: `https://github.com/agent443-dot/AgentGuard/tree/main/e2e`

---

## 13:30 UTC · 10:30 BRT · Video · P4

```text
[VIDEO DAY 15]

39 attack cases run in CI: 24 against Solana, 15 against the EVM chains. Each one is a payment that looks fine and isn't.
```

Caption for the video session: "Inside the attack suite: what a hostile API or agent tries."

---

## 16:00 UTC · 13:00 BRT · Visual · P4

Image: `assets/day-15/01-attacks.png`

```text
What a hostile paid API might ask the hot wallet to sign, and what AgentGuard does:

EVM: approve, Permit, Permit2, EIP-7702 → refused
Solana: SPL Approve, SetAuthority, CloseAccount, unknown programs, hidden lookup-table accounts → refused
```

Alt text: Card titled "What gets thrown at it. And refused." Eyebrow: attack suite, 24 Solana cases,
15 EVM cases. Rows: EVM, approve, Permit or Permit2, EIP-7702 delegation. Solana, SPL Approve,
SetAuthority, CloseAccount. Solana, unknown programs, hidden lookup-table accounts. x402 (e2e), a payTo
moved on the retry. bot (e2e), bad HMAC, replayed webhook, a stranger pressing Approve.

Reply to self:

```text
The end-to-end suite also covers the bot side: a bad HMAC, a replayed webhook, a stranger pressing Approve, and one agent trying to read another's intent.

https://github.com/agent443-dot/AgentGuard/tree/main/e2e
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
Which attack should be case 40?

Something you have seen an agent, a paid API or a malicious page try. Describe the shape, not a live exploit: real vulnerabilities go through the repo's private reporting.
```

---

## Reply bank for Day 15

**"Do the attacks run on a real chain?"**

```text
Mostly on a stub chain in CI, which is fast and repeatable. The Solana cases also ran on devnet through the same inspection and simulation, and the real detection is unit-tested in packages/onchain.
```

**"Why is Permit2 refused if it's just a signature?"**

```text
Because it grants standing authority over funds beyond one payment. The hot wallet signs exactly one kind of typed data on EVM: TransferWithAuthorization, with every field checked.
```

**"What about address lookup tables on Solana?"**

```text
A lookup table can hide which accounts a transaction touches. If it obscures them, the payment is refused: HIDDEN_ACCOUNTS_DETECTED.
```
