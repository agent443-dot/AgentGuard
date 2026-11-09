# Day 03 · Wednesday 2026-11-11 · The agent never holds a key

Theme: the MCP server and what an agent can and cannot do.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/packages/mcp-server/README.md#for-agent-builders`

---

## 13:30 UTC · 10:30 BRT · Video · P3

```text
[VIDEO DAY 03]

Your agent connects to AgentGuard over MCP. It can ask to pay. It cannot touch a key, change its own limits, or approve itself.
```

Caption for the video session: "What an agent can and cannot do through AgentGuard's MCP server."

---

## 16:00 UTC · 13:00 BRT · Technical: connect Claude Code · P3

Image: `assets/day-03/01-mcp-connect.png`

```text
Connecting an agent is one command. Claude Code over stdio:

claude mcp add agentguard -e GUARD_URL=… -e AGENT_ID=… -e AGENT_TOKEN=… -- tsx …/mcp-server/src/main.ts

Claude Desktop, HTTP and any other MCP client are in the README. #MCP
```

Alt text: Code card titled "Connect an agent. It gets tools, not keys." It shows the command `claude
mcp add agentguard` with GUARD_URL set to localhost port 8787, AGENT_ID my-agent, AGENT_TOKEN as a
placeholder, and the path to the mcp-server's tsx and src/main.ts. Footer: "placeholders, not real
values".

Reply to self:

```text
Setup for Claude Desktop, Claude Code over stdio or HTTP, and any other client:
https://github.com/agent443-dot/AgentGuard/blob/main/packages/mcp-server/README.md#for-agent-builders
```

---

## 18:00 UTC · 15:00 BRT · Visual: four tools · P3

Image: `assets/day-03/02-four-tools.png`

```text
Everything an agent can do with money through AgentGuard:

paid_fetch: pay an x402 API
transfer: send to an allowed address
get_budget: read today's spend and limits
check_intent: follow a payment through approval

No tool returns a key. No tool changes a limit.
```

Alt text: Card titled "Everything your agent can do with money." Four rows: paid_fetch, pay for an HTTP
resource that asks for x402. transfer, send dollars to an allowed address. get_budget, read today's
spend and its limits. check_intent, follow a payment through owner approval. Footer: "No tool returns a
key. No tool changes a limit."

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
How do your agents pay for APIs today?

• a key in an env var
• a prepaid account per API
• they don't, a human does
• something else

Genuinely asking. Reply with yours.
```

(Post as an X poll with the first four options if preferred.)

---

## Reply bank for Day 3

**"What does a leaked agent token give an attacker?"**

```text
Spending within that agent's policy, nothing more. No key, no limit changes, no approvals. The owner can revoke the token and it gets a 401 from its next request on.
```

**"Can the agent's reason text trick the owner?"**

```text
The reason is shown to the owner, marked as what the agent says, and never used to decide anything. The approval shows the payment's effect: amount, recipient, chain.
```

**"Does it work with non-Claude agents?"**

```text
Yes. Any MCP client over stdio or HTTP. The command is tsx, the argument src/main.ts, and the environment needs GUARD_URL, AGENT_ID and AGENT_TOKEN.
```

**"Why MCP and not an SDK?"**

```text
MCP lets any agent that already speaks it plug in without new code, and keeps the guard a separate process. The agent never shares memory with anything that holds a key.
```

**"What does the agent see when a payment is refused?"**

```text
A reject code and a plain-English explanation, for example DOMAIN_NOT_ALLOWED or DAILY_EXCEEDED. The README lists every error and what the agent should do next.
```
