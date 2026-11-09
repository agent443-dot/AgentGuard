# Day 10 · Wednesday 2026-11-18 · The pre-release review

Theme: what the review before going public found, and how each finding was fixed.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md`

---

## 13:30 UTC · 10:30 BRT · Video · P2

```text
[VIDEO DAY 10]

Before the repository went public, every package got a review. No critical finding. Two high and six medium, each checked against the code and fixed with a test.
```

Caption for the video session: "The pre-release review: what it found and what changed."

---

## 16:00 UTC · 13:00 BRT · Build in public: the findings · P2

Image: `assets/day-10/01-review.png`

```text
The two high findings from our pre-release review:

1. The Solana kill page took the hot wallet from its link. A wrong one showed "Already killed" while the real limit stayed live.
2. A pause did not reach a payment already waiting on the agent's lock.

Both fixed, with tests.
```

Alt text: Card titled "Two high, six medium. All fixed with tests." Rows: high, Solana kill page
trusted the hot wallet in its link. high, a pause did not reach a payment already waiting. medium,
"spending limit: none" printed for any read error. medium, x402 over plain http to an allowlisted
host. medium, an RPC key in a URL could reach the logs. Plus three more medium: kill prompt edits,
settlement ids, refused terms.

Reply to self:

```text
Some of the mediums:
• status printed "spending limit: none" for any read error, which is what confirms a kill
• viem quotes the RPC URL in its errors, so a key in the URL could reach logs; guard-core now strips every URL

Full table:
https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
Ask us anything about the pre-release review: what we looked at, what we fixed, what is still open.

The whole thing is public, including the low findings we have not fixed yet.
```

---

## Reply bank for Day 10

**"Who did the review?"**

```text
It was our own review: three read-only passes over every package, each finding checked against the code, then fixed with a test. It is not an independent audit, and we don't call it one.
```

**"How do I know the fixes are real?"**

```text
Each fix has a test, and the code is public. The review lists what changed for each finding, so you can find it and check it.
```

**"Why fix 'status: none' as medium?"**

```text
Because "none" is what tells you a kill worked. Printing it for any read error could make you believe a live limit was gone. Now only a missing account reads as none, and the script exits non-zero on anything unexpected.
```

**"What's still open?"**

```text
A list of low findings, none of which moves money past the policy. They are listed in docs/security-review.md, and we are posting them on Day 18 too.
```
