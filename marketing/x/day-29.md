# Day 29 · Monday 2026-12-07 · From clone to a first paid call

Theme: the self-host steps, in order.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md`

---

## 13:30 UTC · 10:30 BRT · Video · P3

```text
[VIDEO DAY 29]

One agent, start to finish: clone the repo, set up your vault and your guard, connect an agent, make a small payment, then kill it.
```

Caption for the video session: "AgentGuard from an empty account to a first paid call."

---

## 16:00 UTC · 13:00 BRT · Technical · P3

Image: `assets/day-29/01-steps.png`

```text
From clone to a first paid call with AgentGuard:

1. clone, install, pnpm check
2. keys
3. your signing page
4. your vault and its cap
5. guard-core and the bot on Fly
6. an agent and its policy
7. a small payment, a kill and a restore, once
```

Alt text: Card titled "From clone to a first paid call." Seven numbered rows: 1, clone, pnpm install,
pnpm check. 2, keys, owner in Phantom, a hot wallet per chain, service tokens. 3, your signing page on
Vercel. 4, your vault and its daily cap, read back. 5, guard-core and the bot on Fly. 6, an agent, its
policy, an MCP client. 7, a small payment, a kill and a restore, once.

Reply to self:

```text
Step 7 matters most. Before you rely on it, run one small payment to an x402 API you control, one full kill, and one restore, on your own setup. The repo ships paywalls you can run yourself.

https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
If you've read this far this month: what would make you try AgentGuard this week, and what is stopping you?

Both answers help. The second one more.
```

---

## Reply bank for Day 29

**"How long does setup take?"**

```text
We haven't timed a fresh setup, so we won't guess. The guide lists each step and links the commands. If you try it, tell us how long it took and where you got stuck.
```

**"Can I skip the signing page?"**

```text
Not for a Phantom owner: it is how you sign the vault's setup and its kill without exporting your key. Deploy your own from your own main.
```
