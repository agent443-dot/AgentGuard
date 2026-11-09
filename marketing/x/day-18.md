# Day 18 · Thursday 2026-11-26 · What is still open

Theme: the open low findings, listed in public. US Thanksgiving: keep the engagement post short.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md`

---

## 13:30 UTC · 10:30 BRT · Video · P2

```text
[VIDEO DAY 18]

Every project has open issues. These are ours, from our own security review: low severity, none moves money past the policy, all public.
```

Caption for the video session: "The open low findings, and why each one is low."

---

## 15:00 UTC · 12:00 BRT · Thread: the open findings · P2

**1/6** · Image: `assets/day-18/01-open-findings.png`

```text
The open findings in AgentGuard's security review. All low, none moves money past the policy. We'd rather you read them here than discover them. 🧵
```

Alt text: Card titled "Still open. None moves money past the policy." Rows: x402, the allowlist matches
the host name, not the port. x402, a repeated request before you answer opens a second approval. x402,
a paid response over 1 MB is marked failed after paying. bot, replay memory is lost on a restart, hooks
are private. bot, status with 25 or more pending approvals is too long for Telegram. Solana, the kill
page trusts the multisig from the link. Solana, token-account rent payer not checked, about 0.002 SOL.

**2/6**

```text
x402:
• the domain allowlist matches the host name, not the port
• a repeated request before you answer opens a second approval
• a paid response over 1 MB is marked failed after the payment
```

**3/6**

```text
The bot:
• its replay memory is lost on a restart. Its hooks are on Fly's private network, not public
• /status with 25 or more pending approvals goes over Telegram's message size
```

**4/6**

```text
Solana:
• the kill page trusts the multisig from its link, so a decoy multisig you control reads "Already killed". Compare the address with pnpm status
• a payment that creates a token account does not check who pays the rent, about 0.002 SOL
```

**5/6**

```text
Also open, before Base launches: the Base hot key is read from an env value. It has to come from a file, as on Solana, before Base goes live.
```

**6/6**

```text
If one of these matters for your setup, open an issue or a PR. The list is kept current in the review:

https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md
```

---

## 20:00 UTC · 17:00 BRT · Engagement (short) · P5

```text
Short one today. Which open finding would you fix first?
```

---

## Reply bank for Day 18

**"Why ship with open findings?"**

```text
Because none of them lets money past the policy or the cap, and every one is written down. Waiting for zero open issues means never shipping; hiding them would be worse.
```

**"Can I fix one?"**

```text
Please. Open a PR against main with a test. Anything that could move funds should go through private reporting first.
```

**"Is the 1 MB issue a loss of funds?"**

```text
It can cost that one payment: it goes through, then the response over 1 MB is marked failed. Bounded by your per-payment limit, and listed as open.
```
