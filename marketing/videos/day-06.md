# Day 06 — The real-money pilot on Robinhood Chain

| Field         | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Date          | 2026-11-14 (Saturday)                                                                          |
| Goal          | Show the path was run end to end with real money, what it found, and how small it was          |
| Target viewer | Skeptical builders who want proof on mainnet, not a demo on a stub chain                       |
| Format        | Vertical 9:16, 1080×1920                                                                       |
| Length        | 60 s                                                                                           |
| Theme         | The real-money Robinhood Chain pilot · build in public                                         |
| Status        | ready to record                                                                                |

## Hook (0–3 s)

**"Before launch, we ran AgentGuard with real money. Fifty cents of it, and then the kill."**

## Scenes

| #   | Time      | Avatar narration (word for word)                                                                                                         | On-screen text                                    | Visual                                                  | Transition |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- | ---------- |
| 1   | 0:00–0:04 | Before launch, we ran AgentGuard with real money. Fifty cents of it. And then the kill.                                                  | `AI presenter` label                              | `01-hook.png` behind presenter                          | —          |
| 2   | 0:04–0:14 | On Robinhood Chain mainnet, the owner created a Safe in Phantom, with a brand-new wallet as its only owner, and funded it with about five U-S-D-G. | Safe created in Phantom · 4.91 USDG     | `02-timeline.png`, rows 1–2                             | push up    |
| 3   | 0:14–0:22 | Then a daily allowance of five U-S-D-G for the hot wallet. A pilot's cap.                                                                | 5 USDG a day                                      | `02-timeline.png`, row 2 highlighted                    | hard cut   |
| 4   | 0:22–0:32 | The agent paid an x402 API zero point five oh U-S-D-G. The payment went through the policy and the simulation, and the transaction is onchain. | 0.50 USDG over x402 · tx 0xa9c7…3d86      | `02-timeline.png`, row 3                                | hard cut   |
| 5   | 0:32–0:40 | Then slash kill paused guard-core, and the owner's Phantom signature removed the hot wallet's allowance. Every step was read back from the chain. | /kill → delegate removed                  | `02-timeline.png`, rows 4–5                             | crossfade  |
| 6   | 0:40–0:50 | It also found real bugs. The deployed bot was older than the code, so it had no Robinhood kill button. The manual kill link worked, and deploys now follow CI. | Live runs find real bugs             | `03-found.png`                                          | push up    |
| 7   | 0:50–0:56 | It was a pilot at a pilot's cap. The launch cap is twenty a day per chain, and it only goes up after weeks without incidents.            | Launch: 20/day per chain                          | `05-scope.png`, then `04-site-roadmap.png` for 1 s       | hard cut   |
| 8   | 0:56–1:00 | The full record is in the repo.                                                                                                          | docs/security-review.md                           | `06-cta.png`                                            | crossfade  |

## Images

Rendered into `assets/day-06/`:

| File                  | Kind                | What it shows                                                                  |
| --------------------- | ------------------- | ------------------------------------------------------------------------------ |
| `01-hook.png`         | card                | "Real money. Real chain. Real kill."                                           |
| `02-timeline.png`     | card                | The five pilot steps, with the shortened public tx hash                        |
| `03-found.png`        | card                | What the pilot found: the stale bot deploy, the dead Solana kill button        |
| `04-site-roadmap.png` | screenshot, `site/` | Roadmap: core stack, real-money pilot, live, next. Tall: pan it                |
| `05-scope.png`        | card                | A pilot at a pilot's cap; launch cap 20 a day; early software                  |
| `06-cta.png`          | end card            | Repo, self-host, private reports                                               |
| `thumb.png`           | thumbnail           | "0.50 USDG. Then the kill."                                                    |

Optional: a screen recording of the pilot transaction `0xa9c7…3d86` on the Robinhood Chain block
explorer. The hash is public; the full value is in `docs/security-review.md`. Show the explorer page
only, with no wallet extension or bookmarks visible, and no explorer logo held on screen as if it
endorsed us. No AI-generated images.

## Avatar direction

Energy 6/10, storytelling. Scene 1: a small, dry half-smile on "Fifty cents of it". Scenes 2–5: one
finger per step, turning the hand slightly each time. Scene 6: open palms, candid. Scene 7: flat palm
low, a slow "small" gesture. No celebration.

## Captions (SRT)

```srt
1
00:00:00,000 --> 00:00:04,000
Before launch, we ran AgentGuard with
real money. 50 cents. Then the kill.

2
00:00:04,000 --> 00:00:09,000
On Robinhood Chain mainnet, the owner
created a Safe in Phantom,

3
00:00:09,000 --> 00:00:14,000
a brand-new wallet as its only owner,
funded with about 5 USDG.

4
00:00:14,000 --> 00:00:22,000
A daily allowance of 5 USDG
for the hot wallet. A pilot's cap.

5
00:00:22,000 --> 00:00:27,000
The agent paid an x402 API
0.50 USDG,

6
00:00:27,000 --> 00:00:32,000
through the policy and the simulation.
The transaction is onchain.

7
00:00:32,000 --> 00:00:36,000
/kill paused guard-core.
One Phantom signature removed the allowance.

8
00:00:36,000 --> 00:00:40,000
Every step was read back
from the chain.

9
00:00:40,000 --> 00:00:45,000
It found real bugs. The deployed bot
was older than the code:

10
00:00:45,000 --> 00:00:50,000
no Robinhood kill button. The manual
link worked; deploys now follow CI.

11
00:00:50,000 --> 00:00:56,000
A pilot at a pilot's cap. Launch:
20 a day per chain, raised only later.

12
00:00:56,000 --> 00:01:00,000
The full record is in the repo.
```

## Thumbnail text

**0.50 USDG. Then the kill.** (kicker: MAINNET PILOT)

## X post

```
Before going public we ran AgentGuard on Robinhood Chain mainnet with real money:

• a Safe created in Phantom, a new wallet as sole owner
• 5 USDG/day allowance for the hot wallet
• an agent paid 0.50 USDG over x402
• /kill, then the owner's Phantom kill removed the delegate

It also found a stale bot deploy. Fixed: deploys now follow CI.

Full record: https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md
```

## CTA

Read the pilot record: `docs/security-review.md` → "Robinhood Chain mainnet pilot" · Star the repo.

## Fact check

| Claim                                                                    | Source                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Pilot on Robinhood Chain mainnet (4663), 2026-11-08/09, real money        | `LAUNCH.md` §1 pilot, `docs/security-review.md` HUMAN-21      |
| Safe created in Phantom, new wallet with its own phrase, sole owner      | `LAUNCH.md` §1, `docs/security-review.md`                     |
| Funded with 4.91 USDG; 5 USDG/day allowance                              | `LAUNCH.md` §1 "Pilot result"                                 |
| 0.50 USDG over x402, tx `0xa9c7…3d86`                                     | `LAUNCH.md` §1, `docs/security-review.md`                     |
| `/kill` paused guard-core; Phantom kill removed the delegate; read back  | `LAUNCH.md` §1, `docs/security-review.md`                     |
| Bot older than `main`, no Robinhood button; manual link worked; deploys follow CI | `docs/final-report.md` (#118, #124), `LAUNCH.md` §1     |
| Launch cap 20/day per chain; 50 only after 2–3 weeks without incidents    | `LAUNCH.md` D1                                                |
