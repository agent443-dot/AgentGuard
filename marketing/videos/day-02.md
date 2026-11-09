# Day 02 — The problem: an agent with a key

| Field         | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Date          | 2026-11-10 (Tuesday)                                                                   |
| Goal          | Make the risk of giving an agent a private key obvious, and show the alternative       |
| Target viewer | Agent builders and people running agents that pay for APIs                             |
| Format        | Vertical 9:16, 1080×1920                                                               |
| Length        | 52 s                                                                                   |
| Theme         | The problem (agents with wallets) · MCP limits                                         |
| Status        | ready to record (scene 6 has a swap line for Solana, see below)                        |

## Hook (0–3 s)

Presenter, close, eyebrows slightly raised, a beat of silence before the last word:
**"Would you hand an AI agent your private key?"**

## Scenes

| #   | Time      | Avatar narration (word for word)                                                                                                           | On-screen text                                  | Visual                                                                  | Transition |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------- | ---------- |
| 1   | 0:00–0:03 | Would you hand an AI agent your private key?                                                                                               | `AI presenter` label                            | `01-hook.png` behind the presenter                                      | —          |
| 2   | 0:03–0:11 | Agents can pay for APIs on their own now, a few cents a call, over x402. The simple way to let one pay is to give it a wallet. And the key. | x402 = pay-per-use APIs                         | AI image A (illustrative), then presenter                               | hard cut   |
| 3   | 0:11–0:19 | Then one bad prompt, or one bug, can move everything that key controls.                                                                    | One prompt. One bug. Everything.                | `02-compare.png`, red row first                                         | push up    |
| 4   | 0:19–0:29 | With AgentGuard, the agent holds no key. It can only ask. Every request is checked against your policy, test-run, and above your threshold, sent to you. | The agent can only ask              | `03-site-how.png`, slow pan through the four steps                      | crossfade  |
| 5   | 0:29–0:41 | It can't change its own limits. It can't pay a site you didn't allow. And paid content comes back marked as data, not instructions. That part is limited, not solved. | Limited, not solved      | `04-cannot.png`, one row per sentence; the amber row last               | hard cut   |
| 6   | 0:41–0:47 | Live on Robinhood Chain today. Solana is next.                                                                                             | Robinhood Chain: live · Solana: next            | Presenter, full frame                                                   | hard cut   |
| 7   | 0:47–0:52 | Read the code. Run your own.                                                                                                               | github.com/agent443-dot/AgentGuard              | `05-cta.png`                                                            | crossfade  |

**Scene 6 swap, only if the owner has confirmed Solana mainnet is live before recording:** "Live on
Robinhood Chain, and now on Solana mainnet too." On-screen text: `Robinhood Chain · Solana: live`.
Otherwise record the line above unchanged.

## Images

Rendered into `assets/day-02/`:

| File              | Kind                | What it shows                                                       |
| ----------------- | ------------------- | ------------------------------------------------------------------- |
| `01-hook.png`     | branded card        | "Would you hand an AI agent your private key?"                      |
| `02-compare.png`  | card                | Agent holds a key (✕) vs agent asks AgentGuard (✓)                  |
| `03-site-how.png` | screenshot, `site/` | "How it works": request, policy, test run, decide. Tall: pan it     |
| `04-cannot.png`   | card                | What the agent cannot do, from `packages/mcp-server/README.md`      |
| `05-cta.png`      | end card            | Repo, self-host, private reports                                    |
| `thumb.png`       | thumbnail           | "Agents with wallets need a guard."                                 |

**AI image A — illustrative, label it `Illustrative` on screen.** Prompt:

> Vertical 9:16 photo-real render, dark studio, near-black background (#050505). A sleek, faceless
> robot hand made of brushed graphite reaches toward a single glowing brass key floating mid-air.
> Soft violet rim light from the upper right (#9945ff), faint mint fill from the lower left
> (#14f195). Shallow depth of field, cinematic, calm, no text, no logos, no coins, no crypto
> symbols, no screens. Empty lower 40% of the frame for captions.

## Avatar direction

Hook: hold eye contact, half a second of stillness before "private key". Scene 3: a slight shake of
the head on "everything". Scene 4: palms open, then one finger raised on "It can only ask". Scene 5:
count three on fingers; drop energy to 5/10 and slow down on "limited, not solved". Scene 6: neutral
and matter-of-fact. No smile on the risk line.

## Captions (SRT)

```srt
1
00:00:00,000 --> 00:00:03,000
Would you hand an AI agent
your private key?

2
00:00:03,000 --> 00:00:07,000
Agents can pay for APIs on their own,
a few cents a call, over x402.

3
00:00:07,000 --> 00:00:11,000
The simple way: give it a wallet.
And the key.

4
00:00:11,000 --> 00:00:19,000
Then one bad prompt, or one bug,
can move everything that key controls.

5
00:00:19,000 --> 00:00:23,000
With AgentGuard, the agent
holds no key. It can only ask.

6
00:00:23,000 --> 00:00:29,000
Checked against your policy, test-run,
and above your threshold, sent to you.

7
00:00:29,000 --> 00:00:34,000
It can't change its own limits.
It can't pay a site you didn't allow.

8
00:00:34,000 --> 00:00:41,000
Paid content comes back as data,
not instructions. Limited, not solved.

9
00:00:41,000 --> 00:00:47,000
Live on Robinhood Chain today.
Solana is next.

10
00:00:47,000 --> 00:00:52,000
Read the code. Run your own.
```

## Thumbnail text

**Agents with wallets need a guard.** (kicker: THE PROBLEM)

## X post

```
Would you give an AI agent your private key?

With AgentGuard it never gets one. It can only ask to pay. Each request goes through your policy and a simulation, and above your threshold it waits for you on Telegram.

It can't raise its own limits or pay a site you didn't allow.

https://github.com/agent443-dot/AgentGuard
```

## CTA

Read the code and run your own: https://github.com/agent443-dot/AgentGuard ·
`packages/mcp-server/README.md` → "For agent builders".

## Fact check

| Claim                                                         | Source                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| x402 lets an API charge per request                           | `site/index.html` FAQ "What is x402?"                   |
| The agent holds no key; it can only ask                       | `README.md`, `site/index.html` How it works             |
| Policy, simulation, approval above a threshold                | `SPEC.md` Goal                                          |
| Can't change limits, can't pay unlisted sites, content fenced | `packages/mcp-server/README.md` "What your agent can and cannot do" |
| Prompt injection limited, not solved                          | `docs/final-report.md` Known risks #7                   |
| Robinhood Chain live, Solana next                             | `README.md`, `LAUNCH.md` D6                             |
