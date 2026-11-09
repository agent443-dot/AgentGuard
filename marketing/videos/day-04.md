# Day 04 — The kill switch: /kill and one Phantom signature

| Field         | Value                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| Date          | 2026-11-12 (Thursday)                                                                     |
| Goal          | Show the two halves of the kill, in order, with the real bot and signing-page text        |
| Target viewer | Owners who will run an agent with money; builders comparing safety designs                |
| Format        | Vertical 9:16, 1080×1920                                                                  |
| Length        | 62 s                                                                                      |
| Theme         | Kill switch in Telegram + one Phantom signature                                           |
| Status        | ready to record                                                                           |

## Hook (0–3 s)

**"Your agent is doing something you didn't expect. Here's how you stop it, in two steps."**

## Scenes

| #   | Time      | Avatar narration (word for word)                                                                                                                    | On-screen text                                 | Visual                                                        | Transition |
| --- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- | ---------- |
| 1   | 0:00–0:04 | Your agent is doing something you didn't expect. Here's how you stop it, in two steps.                                                              | `AI presenter` label                           | `01-hook.png` behind presenter                                | —          |
| 2   | 0:04–0:14 | Step one. In Telegram, send slash kill. The bot tells you exactly what it will do, and asks you to confirm.                                         | Step 1: /kill                                  | `02-chat-kill.png`, the `/kill` bubble first, then the reply  | push up    |
| 3   | 0:14–0:24 | Press Kill everything. guard-core pauses every agent at once. From then on, every payment is refused with the code PAUSED.                           | Every payment → PAUSED                         | `03-chat-engaged.png`                                         | hard cut   |
| 4   | 0:24–0:30 | But pausing the software is only half. The onchain limit is still live. So the bot hands you a Phantom button.                                       | Pausing is only half                           | `03-chat-engaged.png`, highlight the red button               | hard cut   |
| 5   | 0:30–0:42 | Step two. It opens your own signing page, the one you deploy yourself. It says what it will remove, and what Phantom should show. Then you sign, once. | Step 2: one Phantom signature                 | `04-sign-kill.png`                                            | push up    |
| 6   | 0:42–0:49 | The page reads the chain back. Killed. The hot wallet can no longer draw from your vault.                                                            | Read back from the chain                       | `05-sign-killed.png`                                          | crossfade  |
| 7   | 0:49–0:57 | What's left is whatever the hot wallet already holds. That's the bounded part. And always start from slash kill, so the guard stops too.             | Always start from /kill                        | `06-steps.png`, rows one by one                               | hard cut   |
| 8   | 0:57–1:02 | Rehearse it once on your own setup. The guide shows how.                                                                                             | docs/self-host.md → "Before you rely on it"    | `07-cta.png`                                                  | crossfade  |

## Images

Rendered into `assets/day-04/`. Bot text is copied from `packages/telegram-bot/src/domain/chains.ts`
and `text.ts`; signing-page text from `packages/onchain/web/src/evm/kill.ts`. Addresses are
placeholders (`<your Safe>`, `<hot wallet>`), tagged `placeholder addresses` on the card.

| File                  | Kind              | What it shows                                                             |
| --------------------- | ----------------- | ------------------------------------------------------------------------- |
| `01-hook.png`         | card              | "Something looks wrong. Stop it in two steps."                            |
| `02-chat-kill.png`    | chat mock-up      | `/kill` and the bot's warning with **Kill everything** / **Cancel**       |
| `03-chat-engaged.png` | chat mock-up      | "Kill switch engaged…" and **Open Robinhood Chain kill in Phantom**       |
| `04-sign-kill.png`    | signing-page mock | "Kill the hot wallet" with the summary the page shows before Phantom      |
| `05-sign-killed.png`  | signing-page mock | "Killed", read back from the chain                                        |
| `06-steps.png`        | card              | The kill in order: /kill, one signature, /status, what is left            |
| `07-cta.png`          | end card          | Repo, self-host, private reports                                          |
| `thumb.png`           | thumbnail         | "/kill + one signature."                                                  |

The chat mock-ups use a generic chat style on purpose; do not restyle them to look like Telegram's
own interface. No real Phantom screen is shown: if you want one, record it yourself on **devnet**
with a throwaway wallet, and blur the address bar.

## Avatar direction

Energy 6/10, focused, a little faster in scenes 2–3 (urgency without alarm). Scene 2: hold up one
finger. Scene 4: hand flat, tilting side to side on "only half". Scene 5: two fingers. Scene 6: a
small nod on "Killed". Scene 7: slower, 5/10, explain rather than warn.

## Captions (SRT)

```srt
1
00:00:00,000 --> 00:00:04,000
Your agent is doing something unexpected.
Stop it in two steps.

2
00:00:04,000 --> 00:00:09,000
Step one. In Telegram,
send /kill.

3
00:00:09,000 --> 00:00:14,000
The bot says exactly what it will do,
and asks you to confirm.

4
00:00:14,000 --> 00:00:19,000
Press Kill everything. guard-core
pauses every agent at once.

5
00:00:19,000 --> 00:00:24,000
Every payment is now refused
with the code PAUSED.

6
00:00:24,000 --> 00:00:30,000
Pausing the software is only half.
The onchain limit is still live.

7
00:00:30,000 --> 00:00:36,000
Step two. The button opens your own
signing page, the one you deploy.

8
00:00:36,000 --> 00:00:42,000
It says what it will remove and what
Phantom should show. You sign once.

9
00:00:42,000 --> 00:00:49,000
The page reads the chain back. Killed.
The hot wallet can't draw from the vault.

10
00:00:49,000 --> 00:00:53,000
What's left is what the hot wallet
already holds. The bounded part.

11
00:00:53,000 --> 00:00:57,000
Always start from /kill,
so the guard stops too.

12
00:00:57,000 --> 00:01:02,000
Rehearse it once on your own setup.
The guide shows how.
```

## Thumbnail text

**/kill + one signature.** (kicker: KILL SWITCH)

## X post

```
How you stop an AI agent's spending with AgentGuard:

1. /kill in Telegram → Kill everything. guard-core pauses every agent; payments are refused with PAUSED.
2. One Phantom signature on your own signing page removes the onchain limit. The page reads the chain back.

What's left: the hot wallet's balance. That's the bounded part.

Rehearse it once: https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md
```

## CTA

Rehearse the kill on your own setup: `docs/self-host.md` → "Before you rely on it" · the full
runbook is `LAUNCH.md` §4.

## Fact check

| Claim                                                              | Source                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------- |
| `/kill` → Kill everything pauses every agent; payments get PAUSED   | `LAUNCH.md` §4 "Kill, in order" step 1                     |
| The bot then offers a Phantom button per chain; it expires in 15 min | `packages/telegram-bot/src/domain/text.ts`, `LAUNCH.md` §4 |
| The signing page is the owner's own deployment                     | `docs/self-host.md` §3, ADR 003                           |
| The page reads the result back from the chain                      | `docs/final-report.md`, `packages/onchain/web/src/view.ts` |
| Hot wallet keeps its balance after the kill                        | `LAUNCH.md` §4 step 4                                     |
| Always start from `/kill`                                          | `LAUNCH.md` §4, `docs/security-review.md` finding, runbook |
