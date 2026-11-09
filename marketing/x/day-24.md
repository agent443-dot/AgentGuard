# Day 24 · Wednesday 2026-12-02 · The owner key

Theme: known risk #2, a software-wallet owner, and the three conditions.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md`

---

## 13:30 UTC · 10:30 BRT · Video · P2

```text
[VIDEO DAY 24]

The owner key controls the whole vault. We launched with it in Phantom, a software wallet, on purpose and with conditions. This is the trade-off, stated plainly.
```

Caption for the video session: "Why the owner signs in Phantom, and the three conditions that come with it."

---

## 16:00 UTC · 13:00 BRT · Technical · P2

Image: `assets/day-24/01-owner-key.png`

```text
AgentGuard's owner key is in a software wallet (known risk #2). It can move the whole vault, so three conditions are mandatory:

1. a fresh recovery phrase, for it alone
2. used for nothing else
3. a vault holding only what agents need for the coming days
```

Alt text: Card titled "Three conditions. All mandatory." Rows: 1, fresh phrase, a recovery phrase
created for the owner account alone. 2, one job, no dapps, no other tokens, no signing anything else.
3, small vault, only what agents need for the coming days. Footer: "A stolen owner key reaches the
whole vault, not just the daily cap. That is why the vault stays small."

Reply to self:

```text
Not "a new account in your existing Phantom": that shares the wallet's phrase. A new wallet, a new phrase.

There is a Ledger path in the scripts, proven only against a fake device so far. Real hardware is an open item.
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
Hardware wallet or software wallet for an owner key that can move a small vault?

We chose software for launch, with a small vault and a dedicated phrase. Tell us where you'd draw the line.
```

---

## Reply bank for Day 24

**"Why not a Ledger from day one?"**

```text
The kill has to be signable fast, from a phone, through the signing page. Phantom did that in our tests. The Ledger path exists but has only run against a fake device, so we didn't launch on it.
```

**"What if the owner key is stolen?"**

```text
The attacker can move the vault. That is why the vault holds only a few days of agent spending. An attacker who has the owner's wallet is out of scope in SECURITY.md, but we say it plainly.
```

**"Is the same wallet used on every chain?"**

```text
Yes, in our setup the same Phantom wallet owns both vaults. It is in the final report under known risk #2.
```
