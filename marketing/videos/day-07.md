# Day 07 — Week 1, in public

| Field         | Value                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| Date          | 2026-11-15 (Sunday)                                                                           |
| Goal          | Weekly build-in-public recap: what shipped, what is still open, what has to happen before caps rise |
| Target viewer | People who saw a launch video this week; followers deciding whether to watch the repo          |
| Format        | Vertical 9:16, 1080×1920                                                                      |
| Length        | 55 s                                                                                          |
| Theme         | Weekly build-in-public recap · tests and CI                                                    |
| Status        | ready to record; **confirm scene 4 with the owner the day before** (Solana status)            |

## Hook (0–3 s)

**"Week one of AgentGuard in public. What shipped, and what's still open."**

## Scenes

| #   | Time      | Avatar narration (word for word)                                                                                                     | On-screen text                                   | Visual                                       | Transition |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------- | ---------- |
| 1   | 0:00–0:04 | Week one of AgentGuard in public. What shipped, and what's still open.                                                               | `AI presenter` label                             | `01-hook.png` behind presenter               | —          |
| 2   | 0:04–0:16 | The repository is public, under Apache two point oh. It's live on Robinhood Chain mainnet. There's a self-host guide, end to end, and an M-C-P server with four tools for agents. | Shipped                      | `02-shipped.png`, rows one by one            | push up    |
| 3   | 0:16–0:26 | Eight hundred ninety-five automated tests, all passing on the release branch. Plus thirty-nine attack cases. They run on every change. | 895 tests · 39 attack cases                 | `03-tests.png`                               | hard cut   |
| 4   | 0:26–0:32 | Solana mainnet is next. We'll show it here when it's live.                                                                            | Solana: next                                     | Presenter, full frame                        | hard cut   |
| 5   | 0:32–0:48 | Caps stay at twenty a day per chain. Before they go to fifty: weeks on mainnet with nothing unexplained, the kill rehearsed and timed on Solana mainnet, database backups off the volume, and the hot keys in a KMS. | Before 20 → 50                     | `04-before-caps.png`, rows one by one        | push up    |
| 6   | 0:48–0:55 | Every one of those is a checkbox in the repo. Watch it, and hold us to it.                                                            | LAUNCH.md · docs/final-report.md                 | `05-cta.png`                                 | crossfade  |

**Scene 4 swap, only if the owner has confirmed Solana mainnet is live:** "Solana mainnet is live
too, with the same cap: twenty a day." On-screen text: `Solana: live`. Do not use this line on the
strength of a plan or a date; the owner must confirm it.

## Images

Rendered into `assets/day-07/`:

| File                  | Kind       | What it shows                                                              |
| --------------------- | ---------- | -------------------------------------------------------------------------- |
| `01-hook.png`         | card       | "Week one, in public."                                                     |
| `02-shipped.png`      | card       | Repo public; Robinhood Chain live; 895 tests, 39 attack cases; self-host guide; MCP |
| `03-tests.png`        | table card | Test counts per package from `docs/final-report.md` (307/218/168/149/53 = 895) |
| `04-before-caps.png`  | checklist  | "Before raising caps" from `docs/final-report.md`, all unchecked           |
| `05-cta.png`          | end card   | Repo, self-host, private reports                                           |
| `thumb.png`           | thumbnail  | "What shipped. What is still open."                                        |

Optional real screen: the GitHub Actions page of the repository showing a green CI run on `main`.
Record it yourself in a browser with no account menu, notifications or tokens visible. No
AI-generated images.

## Avatar direction

Energy 6/10, conversational, slightly informal: this is the weekly check-in. Scene 2: tick items off
on the fingers. Scene 3: say the numbers slowly and clearly. Scene 5: 5/10, deliberate, one finger per
condition. Scene 6: lean in very slightly on "hold us to it".

## Captions (SRT)

```srt
1
00:00:00,000 --> 00:00:04,000
Week one of AgentGuard in public.
What shipped, what's still open.

2
00:00:04,000 --> 00:00:10,000
The repo is public, Apache-2.0.
Live on Robinhood Chain mainnet.

3
00:00:10,000 --> 00:00:16,000
A self-host guide, end to end,
and an MCP server with four tools.

4
00:00:16,000 --> 00:00:21,000
895 automated tests, all passing
on the release branch.

5
00:00:21,000 --> 00:00:26,000
Plus 39 attack cases.
They run on every change.

6
00:00:26,000 --> 00:00:32,000
Solana mainnet is next.
We'll show it here when it's live.

7
00:00:32,000 --> 00:00:37,000
Caps stay at 20 a day per chain.
Before they go to 50:

8
00:00:37,000 --> 00:00:42,000
weeks on mainnet with nothing
unexplained, the kill timed on Solana,

9
00:00:42,000 --> 00:00:48,000
backups off the volume,
and hot keys in a KMS.

10
00:00:48,000 --> 00:00:55,000
Each one is a checkbox in the repo.
Watch it, and hold us to it.
```

## Thumbnail text

**What shipped. What is still open.** (kicker: WEEK 1 RECAP)

## X post

```
AgentGuard, week 1 in public:

✓ repo public, Apache-2.0
✓ live on Robinhood Chain mainnet
✓ 895 tests passing, 39 attack cases
✓ self-host guide + MCP server (4 tools)

Still open before caps go from 20 to 50/day: weeks with nothing unexplained, a timed kill on Solana mainnet, off-volume backups, hot keys in a KMS.

https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md
```

## CTA

Watch the repo and read "Before raising caps" in `docs/final-report.md` · Star it · Report
vulnerabilities privately.

## Fact check

| Claim                                                         | Source                                                    |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| Repo public, Apache-2.0                                       | `LAUNCH.md` D7, D8; `README.md` License                   |
| Live on Robinhood Chain mainnet                               | `README.md`                                               |
| Self-host guide; MCP server with four tools                   | `docs/self-host.md`; `docs/final-report.md`               |
| 895 tests passing, per-package counts                         | `docs/final-report.md` Test results                       |
| 39 attack cases (24 Solana, 15 EVM)                           | `site/index.html` stats; `docs/final-report.md` attack suite |
| CI runs lint, typecheck and tests on every PR                 | `CLAUDE.md` Code standards; `docs/final-report.md`        |
| Before raising caps: the five conditions                      | `docs/final-report.md` "Before raising caps"; `LAUNCH.md` D1 |
