# Day 13 · Saturday 2026-11-21 · A new agent cannot spend a cent

Theme: deny-all by default, and a sensible first policy. Weekend: two posts.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/SPEC.md`

---

## 15:00 UTC · 12:00 BRT · Video · P3

```text
[VIDEO DAY 13]

A new agent in AgentGuard is denied everything. Empty allowlists mean no recipient and no domain. You open exactly what it needs, nothing more.
```

Caption for the video session: "Writing an agent's first policy."

---

## 19:00 UTC · 16:00 BRT · Technical: a first policy · P3

Image: `assets/day-13/01-policy.png`

```text
A sensible first policy, from our self-host guide:

5 per payment
20 a day
your approval from 1 up
only the API domains you trust

Amounts are strings in base units, never floats. An empty allowlist denies everything.
```

Alt text: Code card titled "Deny-all, until you write this." An example JSON policy: chains
eip155:4663, tokens the USDG address, perTxMax "5000000" (5 per payment), dailyMax "20000000" (20 a
day), approvalThreshold "1000000" (ask me from 1 up), allowedRecipients empty, allowedDomains
api.example.com, paused false. Footer: amounts in base units, 6 decimals, example values.

---

## Reply bank for Day 13

**"What's the difference between dailyMax and the onchain cap?"**

```text
dailyMax is guard-core's limit for one agent. The onchain cap bounds the hot wallet whatever guard-core does. dailyMax must be at or below the onchain cap.
```

**"Can the agent read its policy?"**

```text
It can read its budget: spent today, the limits and the chains it may use. It cannot change any of it. Only the admin route, on the private network, sets a policy.
```

**"Can I allow one recipient for transfers?"**

```text
Yes: put it in allowedRecipients. An empty list denies all direct transfers, and an empty allowedDomains denies all x402 payments.
```
