# Day 01 — Open source, live on Robinhood Chain

| Field         | Value                                                                                   |
| ------------- | --------------------------------------------------------------------------------------- |
| Date          | 2026-11-09 (Monday), launch day                                                         |
| Goal          | Announce the public repository and say in one breath what AgentGuard is and is not      |
| Target viewer | Builders who give AI agents money to spend (x402 APIs, transfers), crypto-native devs   |
| Format        | Vertical 9:16, 1080×1920                                                                |
| Length        | 52 s                                                                                    |
| Theme         | Launch · the problem · the onchain cap (overview)                                       |
| Status        | ready to record                                                                         |

## Hook (0–3 s)

Presenter, close, 7/10 energy: **"Your AI agent can pay for things now. It never holds a key."**
On screen: `01-hook.png` behind the presenter's lower half.

## Scenes

| #   | Time      | Avatar narration (word for word)                                                                                                       | On-screen text                                   | Visual                                                              | Transition      |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- | --------------- |
| 1   | 0:00–0:03 | Your AI agent can pay for things now. It never holds a key.                                                                            | `AI presenter` label, lower left                 | Presenter top half; `01-hook.png` fills the frame behind            | —               |
| 2   | 0:03–0:10 | Today AgentGuard goes open source. And it's live on Robinhood Chain mainnet.                                                            | OPEN SOURCE · APACHE-2.0                         | `02-site-hero.png`, slow pan down to "Robinhood Chain live"        | push up         |
| 3   | 0:10–0:20 | Your agent asks to pay. AgentGuard checks your policy, test-runs the payment, and above your threshold, it asks you on Telegram.        | Policy → test run → your OK                      | Presenter, PiP bottom-right; three words appear one by one         | hard cut        |
| 4   | 0:20–0:30 | Your money stays in a vault that only your Phantom wallet controls. The chain itself caps what can leave it each day.                   | The cap is enforced onchain                      | `03-flow.png`, boxes revealed top to bottom                         | crossfade       |
| 5   | 0:30–0:38 | So your worst day is the cap plus the hot wallet. Even if the guard is compromised. At launch: twenty a day, per chain.                | Worst day = cap + hot wallet                     | `04-formula.png`, the "30" lands on "per chain"                    | push up         |
| 6   | 0:38–0:46 | It's early. Solana is next, Base comes later, and the known risks are written down in the repo.                                        | Early software. Risks: docs/final-report.md      | `06-status.png`; then `05-site-stats.png` for 1 s                   | hard cut        |
| 7   | 0:46–0:52 | Run your own copy. Star the repo. And if you find a hole, report it privately.                                                         | github.com/agent443-dot/AgentGuard               | `07-cta.png`, presenter leaves the frame                            | crossfade, end  |

## Images

All rendered from the repository into `assets/day-01/` (1080×1920). Re-render with
`node marketing/videos/assets/src/render.cjs day-01`.

| File                 | Kind                   | What it shows                                                        |
| -------------------- | ---------------------- | -------------------------------------------------------------------- |
| `01-hook.png`        | branded card           | "Your AI agent can pay. It never holds a key."                       |
| `02-site-hero.png`   | screenshot, `site/`    | The landing page hero. Its payment feed is labelled "simulated example" on the page; keep that visible |
| `03-flow.png`        | diagram card           | Vault → onchain daily cap → hot wallet → x402 APIs                   |
| `04-formula.png`     | card                   | Max loss per day = cap + hot wallet: 20 + 10 = 30 per chain          |
| `05-site-stats.png`  | screenshot, `site/`    | 3 chains, 895 tests, 39 attack scenarios, 20 reject reasons, 0 contracts |
| `06-status.png`      | card                   | Live on Robinhood Chain; Solana next; Base later; known risks        |
| `07-cta.png`         | end card               | Repo, self-host guide, private security reports                      |
| `thumb.png`          | thumbnail              | "Agents pay. Keys stay home."                                        |

No AI-generated images in this video.

## Avatar direction

Energy 7/10 for the hook, 6/10 after. Medium close-up, eyes on the upper third, still background.
Scene 3: count three on the fingers of one hand, one finger per step. Scene 4: flat palm, a slow
downward press on "caps". Scene 6: a small nod and a slower pace on "It's early" — no smile, no
frown. Scene 7: a short, open-handed gesture toward the lower half (where the CTA card is), then
leave frame.

## Captions (SRT)

```srt
1
00:00:00,000 --> 00:00:03,000
Your AI agent can pay for things now.
It never holds a key.

2
00:00:03,000 --> 00:00:10,000
Today AgentGuard goes open source.
It's live on Robinhood Chain mainnet.

3
00:00:10,000 --> 00:00:15,000
Your agent asks to pay. AgentGuard
checks your policy, test-runs it,

4
00:00:15,000 --> 00:00:20,000
and above your threshold,
it asks you on Telegram.

5
00:00:20,000 --> 00:00:25,000
Your money stays in a vault only
your Phantom wallet controls.

6
00:00:25,000 --> 00:00:30,000
The chain itself caps what
can leave it each day.

7
00:00:30,000 --> 00:00:34,000
Your worst day: the cap
plus the hot wallet.

8
00:00:34,000 --> 00:00:38,000
Even if the guard is compromised.
At launch: 20 a day, per chain.

9
00:00:38,000 --> 00:00:42,000
It's early. Solana is next,
Base comes later,

10
00:00:42,000 --> 00:00:46,000
and the known risks are
written down in the repo.

11
00:00:46,000 --> 00:00:52,000
Run your own copy. Star the repo.
Report holes privately.
```

## Thumbnail text

**Agents pay. Keys stay home.** (kicker: OPEN SOURCE LAUNCH) — `assets/day-01/thumb.png`

## X post

```
AgentGuard is open source today, and live on Robinhood Chain mainnet.

Your AI agent asks to pay. AgentGuard checks your policy, simulates the payment, and above your threshold asks you on Telegram. The agent never holds a key.

Worst day = onchain cap + hot wallet balance. Launch cap: 20/day per chain.

Early software. Risks are in the repo.
https://github.com/agent443-dot/AgentGuard
```

Description: start with the standard block in `style-guide.md` ("AI presenter. …").

## CTA

Star the repo and read the code: https://github.com/agent443-dot/AgentGuard · Run your own:
`docs/self-host.md` · Report vulnerabilities privately: GitHub → Security → Report a vulnerability.

## Fact check

| Claim                                                  | Source                                   |
| ------------------------------------------------------ | ---------------------------------------- |
| Open source, Apache-2.0, launched 2026-11-09           | `README.md` Status, `LAUNCH.md` D7, D8   |
| Live on Robinhood Chain mainnet; Solana next; Base later | `README.md`, `LAUNCH.md` D6             |
| Policy → simulation → Telegram above a threshold       | `README.md`, `SPEC.md` Goal              |
| Vault controlled by the owner's Phantom wallet         | `docs/self-host.md`, `LAUNCH.md` D4      |
| Worst day = cap + hot wallet, even if compromised      | `docs/self-host.md`, `SECURITY.md`       |
| 20 a day per chain; hot wallet holds at most 10        | `LAUNCH.md` D1                           |
| Known risks written down                               | `docs/final-report.md` Known risks       |
