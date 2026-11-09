# Day 20 · Saturday 2026-11-28 · Handling pending_approval

Theme: what an agent should do while the owner decides. Weekend: two posts.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/packages/mcp-server/README.md#for-agent-builders`

---

## 15:00 UTC · 12:00 BRT · Video · P3

```text
[VIDEO DAY 20]

Your agent asked to pay, and the payment is waiting for its owner. What should the agent do now? Mostly: wait, and don't ask twice.
```

Caption for the video session: "pending_approval, from the agent's side."

---

## 19:00 UTC · 16:00 BRT · Technical · P3

Image: `assets/day-20/01-pending.png`

```text
When an AgentGuard payment returns pending_approval, the agent should:

1. tell the user it is waiting
2. call check_intent every 15–30 s
3. never repeat the payment while pending
4. on approved (paid_fetch): repeat exactly the same request, once
```

Alt text: Card titled "While the owner decides, the agent waits." Rows: pending, tell the user, poll
check_intent every 15 to 30 seconds, never repeat the payment. approved, paid_fetch repeats exactly the
same request, once. executed, done, the result has the transaction id. rejected, the owner said no, do
not retry. expired, no answer in time, nothing moved.

Reply to self:

```text
The tool results already tell the model this. A client that drives the tools without a model should follow the same steps; examples/demo-agent in the mcp-server package does.
```

---

## Reply bank for Day 20

**"What if guard-core times out mid-payment?"**

```text
The tool says AgentGuard could not be reached. Call get_budget before retrying: the payment may have gone through.
```

**"Is a rejection an error?"**

```text
No. A rejection is a decision, with codes that explain it. A tool error means the call never reached a decision.
```

**"Why exactly the same request?"**

```text
The approval is for exactly those terms. Repeating the same url, method, headers and body is what redeems it, once.
```
