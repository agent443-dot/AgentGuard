# Day 25 · Thursday 2026-12-03 · The life of one payment

Theme: one real intent from the mainnet pilot, end to end.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md`

---

## 13:30 UTC · 10:30 BRT · Video · P1

```text
[VIDEO DAY 25]

One payment, from the agent's request to the receipt: 0.50 USDG on Robinhood Chain mainnet, through every step AgentGuard has.
```

Caption for the video session: "The life of intent 9a594294, step by step."

---

## 15:00 UTC · 12:00 BRT · Thread · P1

**1/7** · Image: `assets/day-25/01-life.png`

```text
The life of one real AgentGuard payment: intent 9a594294 on Robinhood Chain mainnet, 0.50 USDG over x402. 🧵
```

Alt text: Diagram titled "The life of one payment. 0.50 USDG." Request, paid_fetch to the one allowed
domain. Arrow: policy, chain 4663, USDG, at most 1 per payment, at most 5 a day. Auto-approved, under
the threshold. Arrow: EIP-3009 authorization, signed by the hot wallet only. Settled, tx
0xa9c7abff…78083d86, allowance 500000 spent.

**2/7**

```text
The setup: a Safe owned by a fresh Phantom wallet alone, holding 4.914759 USDG. The Allowance Module on, with the hot wallet as delegate: 5 USDG per 1440 minutes, 0 spent.
```

**3/7**

```text
The policy: chain eip155:4663, token USDG, 1 per payment, 5 a day, one allowed domain.

The agent called paid_fetch on that domain. The API answered 402.
```

**4/7**

```text
guard-core checked the terms against the policy and simulated the transfer. 0.50 was under the threshold, so it was auto-approved.

The hot wallet signed one EIP-3009 authorization. The paywall verified it and settled it itself, paying the gas.
```

**5/7**

```text
Read back from the chain afterwards:

• the Safe: 4.414759 USDG
• the allowance: 500000 spent (0.50)
• the hot wallet: 0 USDG
```

**6/7**

```text
Then the kill: /kill → Confirm paused the agent. The owner signed removeDelegate in Phantom, and the page read back "no longer a delegate".
```

**7/7**

```text
Every step, with the transaction hash:

https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
What would you want logged for every payment an agent makes?

Ours: the request, the policy decision and its reasons, the simulation, the approval if any, and the transaction. What are we missing?
```

---

## Reply bank for Day 25

**"Why was the hot wallet empty after?"**

```text
It drew exactly what it needed from the Safe through the allowance, then paid it. Nothing sat in the hot wallet afterwards.
```

**"Who paid the gas?"**

```text
In this payment, the paywall settled the EIP-3009 authorization itself and paid the gas from its own key. The hot wallet keeps a little native token for gas when it draws from the Safe.
```

**"Is there an explorer link?"**

```text
The transaction hash is in docs/security-review.md: 0xa9c7abffb5676651193e866e4f02d9925a72c100ba20972226075dad78083d86 on Robinhood Chain (4663).
```

Before posting that reply, confirm the hash character by character against `docs/security-review.md`.
