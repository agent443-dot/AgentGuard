# Day 17 · Wednesday 2026-11-25 · One yes, one payment

Theme: exactly what an approval covers.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/SPEC.md`

---

## 13:30 UTC · 10:30 BRT · Video · P1

```text
[VIDEO DAY 17]

When you approve a payment in Telegram, you approve that payment: this amount, this recipient, this chain, once. It cannot be reused or stretched.
```

Caption for the video session: "What an approval covers, and what happens when it expires."

---

## 16:00 UTC · 13:00 BRT · Technical · P1

Image: `assets/day-17/01-approval-scope.png`

```text
What your approval in AgentGuard covers:

• exactly the approved chain, token, amount, recipient and domain
• redeemed once
• 10 minutes to answer, or it expires: APPROVAL_TIMEOUT
• only listed owners can press the button
```

Alt text: Card titled "What your approval covers. Exactly." Rows: Terms, this chain, token, amount,
recipient and domain. Once, redeemed a single time, then spent. 10 minutes, unanswered or unredeemed,
APPROVAL_TIMEOUT. Owners only, a stranger pressing Approve is refused.

Reply to self:

```text
For x402, after you approve, the agent repeats the same request and that redeems the approval. If the site changes the terms in between, it doesn't match, and nothing is paid.
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
What approval threshold would you set for an agent you trust, but not fully?

Ours is per agent, so a research agent and a trading bot can live under very different rules.
```

---

## Reply bank for Day 17

**"What if two requests come in before I approve?"**

```text
Known and listed as open, low: a repeated x402 request before you answer opens a second approval. Each still needs its own yes, and the daily limits still apply.
```

**"Can I approve from more than one account?"**

```text
Yes: OWNER_TELEGRAM_IDS takes a list. Anyone else pressing Approve is refused.
```

**"Does approving raise my limits?"**

```text
No. An approval only lets that one payment through the threshold. Per-payment and daily limits still apply, and the onchain cap is untouched.
```
