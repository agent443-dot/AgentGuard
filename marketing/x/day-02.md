# Day 02 · Tuesday 2026-11-10 · Solana

Theme: Solana mainnet is planned for today. **Post variant A only after the owner confirms Solana is
live.** Until then, post variant B. The thread works for both.

Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md`

---

## 13:30 UTC · 10:30 BRT · Video · P1

**Variant A, Solana live (owner confirmed)** · Image if no video: `assets/day-02/02-solana-live.png`

```text
[VIDEO DAY 02]

AgentGuard is now live on Solana mainnet too.

Same guard, same policy, same /kill. On Solana the daily cap is a Squads v4 Spending Limit, with the hot wallet as its only member and only destination. Launch cap: 20 a day.
```

Alt text (image): Card titled "Solana mainnet: live." Text: "Same guard, same policy, same kill. The
daily cap is a Squads v4 Spending Limit with the hot wallet as its only member and only destination.
Launch cap: 20 a day."

**Variant B, Solana still next** · Image if no video: `assets/day-02/01-solana-next.png`

```text
[VIDEO DAY 02]

Robinhood Chain: live. Solana: next. Base: later.

On Solana the cap is a Squads v4 Spending Limit. It ran end to end on devnet with real Telegram and Phantom, and the cap is tested against the real Squads program. Mainnet when it is ready.
```

Alt text (image): Card with three lines: "Robinhood Chain: live. Solana: next. Base: later." Below:
"Solana runs on a Squads v4 Spending Limit. Proven on devnet with real Telegram and Phantom, and in
automated tests against the real Squads program."

Caption for the video session: "How the daily cap works on Solana, and how it differs from the Safe
chains."

---

## 15:00 UTC · 12:00 BRT · Thread: same promise, two mechanisms · P4

**1/6** · Image: `assets/day-02/03-two-mechanisms.png`

```text
AgentGuard makes one onchain promise on every chain: the worst day costs the daily cap plus the hot wallet balance.

But the mechanism differs between Solana and the Safe chains, and that difference matters. A short thread. 🧵
```

Alt text: Card titled "The loss bound is the same. The path is not." Rows: Solana, Squads Spending
Limit, the cap can only move into the hot wallet. Safe chains, Allowance Module, the delegate can send
the cap to any address. Both, worst day equals daily cap plus hot wallet balance. Footer: "A stolen hot
key on a Safe chain can send the day's cap anywhere without guard-core seeing it. Known risk #1 in our
final report."

**2/6**

```text
On Solana the cap is a Squads v4 Spending Limit.

The hot wallet is its only member and its only destination. A stolen hot key can draw the day's cap, but only into the hot wallet itself.
```

**3/6**

```text
On Robinhood Chain (and Base later) the cap is the Safe Allowance Module 0.1.1.

The hot wallet is the delegate, and a delegate can send its allowance to any address. A stolen hot key could move the day's cap straight out, without guard-core seeing it.
```

**4/6**

```text
Same bound, different path. That is known risk #1 in our final report, not a footnote.

It is one reason the launch cap is 20 a day per chain, and why the hot keys move to a KMS once caps rise.
```

**5/6**

```text
How the cap was proven:

• Solana: automated tests against the real Squads program under LiteSVM: cap, cap + 1, daily refill, after kill
• Safe: Foundry on a Base mainnet fork, and live on Robinhood Chain mainnet
```

**6/6**

```text
The table of what works on each chain, and the seven known risks:

https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
If your agent can pay for things today: what is its per-payment limit?

"None" is an honest answer. We started from deny-all and still argue about where the default approval threshold should sit.
```

---

## Reply bank for Day 2

**"Why not restrict the Safe delegate's destination too?"**

```text
The Allowance Module has no destination lock, and we chose not to write a contract of our own. So the onchain bound is the same, the path is wider, and we say so: known risk #1.
```

**"When is Solana mainnet?"** (variant B)

```text
When the setup is done and checked, not on a date we promise. Robinhood Chain is live now. We will post when Solana is, with what we read back from the chain.
```

**"What is LiteSVM?"**

```text
A lightweight Solana runtime for tests. We dumped the real Squads v4 program from mainnet and ran the cap properties against it: a draw up to the cap passes, cap + 1 is refused, it refills after a day, nothing after the kill.
```

**"Why 20 a day?"**

```text
It is the launch cap, chosen to keep a bad day small while it runs on mainnet. It goes to 50 only after a checklist: 2–3 clean weeks, a timed kill on Solana mainnet, backups off the volume, and hot keys in a KMS.
```

**"Can I set a different cap?"**

```text
Yes. It is your vault and your cap: you set it when you add the limit on your signing page. The signing page also has a maximum it will accept, MAX_DAILY_CAP, which you configure.
```
