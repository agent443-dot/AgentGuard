# Day 09 · Tuesday 2026-11-17 · x402, and paid content as data

Theme: how `paid_fetch` pays an x402 API, and why prompt injection is limited, not solved.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/packages/mcp-server/README.md#for-agent-builders`

---

## 13:30 UTC · 10:30 BRT · Video · P3

```text
[VIDEO DAY 09]

x402 lets an API charge a small fee per request. With AgentGuard, your agent never pays it directly: the guard reads the payment request, checks it, and pays only if your policy allows. #x402
```

Caption for the video session: "x402 in one minute, and where AgentGuard sits in it."

---

## 15:00 UTC · 12:00 BRT · Thread: paid content is data · P4

**1/7** · Image: `assets/day-09/01-x402-flow.png`

```text
How an agent pays an x402 API through AgentGuard, and the one risk we have only limited, not solved. 🧵
```

Alt text: Diagram titled "An API asks for payment. The guard decides." Step 1, request, guard-core
fetches the URL for the agent. Arrow: 402 Payment Required with network, asset, payTo, amount. Step 2,
policy plus simulation, domain allowlist, limits, the exact transfer. Arrow: above your threshold,
Telegram first. Step 3, sign and retry, the 402 terms must equal the approved intent. Arrow: the paid
response returns to the agent, marked as data.

**2/7**

```text
The agent calls paid_fetch with a URL. guard-core makes the request.

If the site answers 402, guard-core parses the terms: network, asset, payTo, amount. A domain not on the allowlist is refused before any request is made.
```

**3/7**

```text
Then the usual: per-payment and daily limits, a simulation of the exact transfer, and your approval on Telegram above your threshold.

Before signing, the 402's network, asset, payTo and amount must equal the intent that was approved. A payTo moved on the retry is refused.
```

**4/7**

```text
x402 runs over https only. Plain http is allowed only to loopback.

That came from our pre-release review: over plain http, anyone on the path could rewrite the 402 and its payTo.
```

**5/7** · Image: `assets/day-09/02-untrusted.png`

```text
The paid response comes back to the agent fenced as untrusted third-party data, and the model is told never to follow instructions inside it.

That is known risk #7: limited, not solved.
```

Alt text: Card titled "Paid content is data, not instructions." Rows: Marked, paid_fetch fences the
response as untrusted third-party data. Still bound, every payment meets the policy and, above the
threshold, you. Ignored text, the agent's reason is shown to you, never used to decide. Not solved, a
model that ignores the marking can still ask to pay.

**6/7**

```text
A model that ignores the marking can still ask to pay. What it cannot do is pay more than the policy allows, pay a domain you did not allow, or skip your approval above the threshold.

The limit is the policy, not the model's good behavior.
```

**7/7**

```text
The tools, the errors and what an agent should do with each one:

https://github.com/agent443-dot/AgentGuard/blob/main/packages/mcp-server/README.md#for-agent-builders
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
Would you let an agent buy API calls on its own, without asking, if each one is under $1 and the day is capped?

Where is your "auto-approve" line? Our guide suggests asking above 1.
```

---

## Reply bank for Day 9

**"What is x402?"**

```text
An open standard for charging per request over HTTP. The server answers 402 Payment Required with its terms, the client pays and retries. AgentGuard sits on the client side and decides whether to pay.
```

**"What if the site changes the price on retry?"**

```text
Refused. Before signing, the 402's network, asset, payTo and amount must equal the approved intent. An approval is redeemed once, for exactly those terms.
```

**"Which x402 SDK versions?"**

```text
@x402/core, @x402/svm and @x402/evm 2.29.0 in the lockfile, above the 2.28.0 floor in the spec.
```

**"Can't you just filter injected prompts?"**

```text
Filters help, but nobody can promise they catch everything. So we do not rely on the model: the policy, the allowlists and the cap hold whatever the model decides.
```
