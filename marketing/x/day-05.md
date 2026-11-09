# Day 05 · Friday 2026-11-13 · Big payments wait for your thumb

Theme: Telegram approvals, and crediting a real bug the live runs found.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md`

---

## 13:30 UTC · 10:30 BRT · Video · P1

```text
[VIDEO DAY 05]

Set a threshold. Anything at or above it lands in your Telegram with what the payment will actually do. One yes, one payment. No answer in 10 minutes, no payment.
```

Caption for the video session: "An approval on Telegram, from the agent's request to the payment."

---

## 16:00 UTC · 13:00 BRT · Visual: the approval · P1

Image: `assets/day-05/01-site-telegram.png`

```text
What you approve is the effect, not the agent's story.

The Telegram message shows the amount, the domain, the chain and the change to the spending wallet. The agent's reason is shown too, marked unverified.

Your yes covers that one payment, once.
```

Alt text: Screenshot of the AgentGuard website, "Big payments wait for your thumb." On the right, an
illustrative Telegram approval: "Approval needed, agent-1. Pay 18.00 USDG. Kind x402, domain
api.datafeed.example, chain Robinhood Chain, effect spending wallet minus 18.00 USDG. Agent says:
Premium market data for the weekly report. Unverified. Expires in 9:41", with Approve and Reject
buttons. This is the site's example, not a real payment.

---

## 18:00 UTC · 15:00 BRT · Build in public: a bug we found · P2

Image: `assets/day-05/02-bug-63.png`

```text
A bug our own live runs found:

The first payment from an empty hot wallet on Base Sepolia failed with SIM_FAILED. The simulation ran before the top-up from the vault, so it saw nothing to pay with.

Fixed in #63: top up, then simulate. Re-checked live on Solana devnet.
```

Alt text: Card titled "An empty hot wallet could never pay." Rows: What happened, first payment from
an empty hot wallet on Base Sepolia, SIM_FAILED. Why, the simulation ran before the top-up from the
vault. Fix, top up first, then simulate the exact transfer, reason now logged (#62). Re-checked, live
on Solana devnet from a hot wallet with no token account at all.

Reply to self:

```text
Every bug the live runs found is listed with its fix in the final report. Tests passing on a stub chain did not catch this one. A real chain did.
https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
Where would you set the approval threshold for an agent buying API calls?

Our self-host guide suggests starting at: 5 per payment, 20 a day, your approval above 1. Too tight? Too loose?
```

---

## Reply bank for Day 5

**"What if I'm asleep?"**

```text
Then the payment waits, and after 10 minutes it expires: APPROVAL_TIMEOUT. Nothing is paid by default. Payments under your threshold still go through within the policy.
```

**"Can someone fake a Telegram approval?"**

```text
Only owners listed in OWNER_TELEGRAM_IDS can act. Every hook from guard-core to the bot is HMAC-signed, and stale or replayed requests are refused. An approval is redeemed once.
```

**"What if the bot restarts mid-approval?"**

```text
Pending approvals expire. Fail safe: nothing is paid by default.
```

**"Why Telegram?"**

```text
It is on the owner's phone, it has buttons, and a bot can run with no public IP: ours answers Telegram by long polling. Other channels could come later; we have not built them.
```
