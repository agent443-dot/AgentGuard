# Presentation video — AgentGuard in 90 seconds

| Field         | Value                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| Goal          | The evergreen intro: what AgentGuard is, how it protects the money, where it runs, the risks |
| Target viewer | Anyone landing on the repo, the site or a pinned post for the first time                   |
| Format        | Horizontal 16:9, 1920×1080 (for a vertical cut, swap in the `day-01` images, same narration) |
| Length        | 1:32                                                                                       |
| Use           | Pinned post on X, YouTube channel trailer, top of the site or README                       |
| Status        | ready to record                                                                            |

All images already exist in `marketing/videos/assets/day-05/` (horizontal) and `day-01/`
(vertical). Tone, presenter, captions and music: [`style-guide.md`](./style-guide.md).

## Hook (0–5 s)

**"AI agents can pay for things now. AgentGuard makes sure they never hold the key."**

## Scenes

Presenter on the left third; images on the right two thirds unless noted.

| #   | Time      | Avatar narration (word for word)                                                                                                                                                   | On-screen text                                        | Image (`assets/day-05/`)                          | Transition |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- | ---------- |
| 1   | 0:00–0:05 | AI agents can pay for things now. AgentGuard makes sure they never hold the key.                                                                                                   | `AI presenter` label, lower left                      | `thumb.png`, full frame, presenter fades in        | —          |
| 2   | 0:05–0:15 | AgentGuard is an open-source guard that sits between your agent and your money. You run your own copy. There's no hosted service.                                                  | Lower-third: `AgentGuard / OPEN SOURCE · SELF-HOSTED` | `02-site-hero.png` (keep "simulated example" visible) | push left |
| 3   | 0:15–0:32 | When your agent wants to pay, an x402 API or a transfer, it can only ask. AgentGuard checks your policy, test-runs the exact payment, and then approves it, sends it to you on Telegram, or rejects it. | Ask → policy → test run → decide       | `03-site-how.png`, slow pan across the four steps | hard cut   |
| 4   | 0:32–0:42 | Above your threshold, you see the real effect on your phone. Not the agent's story. One yes, one payment.                                                                         | One yes = one payment                                 | `06-site-approval.png`                            | push left  |
| 5   | 0:42–0:57 | Your money stays in a vault only your Phantom wallet controls. A spend limit built into Squads or Safe refills a small hot wallet, never above your daily cap. So your worst day is the cap plus the hot wallet. Even if the guard is compromised. | Worst day = cap + hot wallet | `04-site-money.png`, zoom 105% on the calculator at the end | crossfade |
| 6   | 0:57–1:05 | If anything looks wrong, slash kill pauses every agent. And one Phantom signature removes the onchain limit.                                                                       | /kill + one Phantom signature                         | `05-site-security.png`, pan to "One-tap kill switch" | hard cut |
| 7   | 1:05–1:15 | It's live on Robinhood Chain mainnet, after a real-money pilot. Solana is next, Base later. Eight hundred ninety-five automated tests, and thirty-nine attack cases.                  | Robinhood Chain: live · Solana: next · Base: later    | `07-site-chains.png`                              | push left  |
| 8   | 1:15–1:25 | It's early. And the known risks are written down in the repo, right next to the code.                                                                                             | Known risks: docs/final-report.md                     | `09-risks.png`, rows one by one                   | hard cut   |
| 9   | 1:25–1:32 | Run your own, connect your agent through M-C-P, and if you find a hole, report it privately.                                                                                       | github.com/agent443-dot/AgentGuard                    | `10-cta.png`, presenter leaves the frame          | crossfade  |

**Solana swap (scene 7), only if the owner confirms Solana mainnet is live:** "It's live on Robinhood
Chain and Solana mainnet, after a real-money pilot. Base comes later." On-screen text:
`Robinhood Chain · Solana: live · Base: later`. Then re-render `07-site-chains.png` once the site is
updated.

## Images

| File (`assets/day-05/`)  | What it shows                                                    |
| ------------------------ | ---------------------------------------------------------------- |
| `thumb.png`              | "How an agent pays without a key." Opening frame and thumbnail   |
| `02-site-hero.png`       | Landing page hero                                                |
| `03-site-how.png`        | The four steps: request, policy, test run, decide                |
| `06-site-approval.png`   | The site's example approval ("Pay 18.00 USDG"). It is an example, not a real payment |
| `04-site-money.png`      | Vault → cap → hot wallet, and the loss calculator at 20 / 10 (vault value illustrative) |
| `05-site-security.png`   | Security model, including the kill switch                        |
| `07-site-chains.png`     | Robinhood Chain live, Solana next, Base later                    |
| `09-risks.png`           | Four known risks                                                 |
| `10-cta.png`             | Repo, self-host guide, private reports                           |

Vertical cut (1080×1920): use `day-01/01-hook.png`, `02-site-hero.png`, `day-02/03-site-how.png`,
`day-03/03-site-calculator.png`, `day-04/06-steps.png`, `day-01/06-status.png`,
`day-05`'s risks as text over the presenter, and `day-01/07-cta.png`.

No AI-generated images. Nothing on screen shows a key, token, `.env` or real address.

## Avatar direction

Energy 6/10, 7/10 on the hook. Medium shot, presenter on the left third, slightly turned toward the
images. Scene 3: count the steps on the fingers. Scene 5: one hand above the other, the upper one
"refilling" the lower; flat palm on "never above your daily cap". Scene 8: slower, 5/10, no smile.
Scene 9: back to the lens, a small open-hand gesture, then step out.

## Captions (SRT)

```srt
1
00:00:00,000 --> 00:00:05,000
AI agents can pay for things now.
AgentGuard makes sure they never hold the key.

2
00:00:05,000 --> 00:00:10,000
An open-source guard between
your agent and your money.

3
00:00:10,000 --> 00:00:15,000
You run your own copy.
There's no hosted service.

4
00:00:15,000 --> 00:00:21,000
When your agent wants to pay,
an x402 API or a transfer, it can only ask.

5
00:00:21,000 --> 00:00:26,000
AgentGuard checks your policy and
test-runs the exact payment.

6
00:00:26,000 --> 00:00:32,000
Then it approves it, sends it to you
on Telegram, or rejects it.

7
00:00:32,000 --> 00:00:37,000
Above your threshold, you see
the real effect on your phone.

8
00:00:37,000 --> 00:00:42,000
Not the agent's story.
One yes, one payment.

9
00:00:42,000 --> 00:00:47,000
Your money stays in a vault only
your Phantom wallet controls.

10
00:00:47,000 --> 00:00:52,000
A built-in spend limit refills a small
hot wallet, never above your daily cap.

11
00:00:52,000 --> 00:00:57,000
Worst day: the cap plus the hot wallet.
Even if the guard is compromised.

12
00:00:57,000 --> 00:01:05,000
/kill pauses every agent. One Phantom
signature removes the onchain limit.

13
00:01:05,000 --> 00:01:10,000
Live on Robinhood Chain mainnet, after
a real-money pilot. Solana next, Base later.

14
00:01:10,000 --> 00:01:15,000
895 automated tests,
39 attack cases.

15
00:01:15,000 --> 00:01:25,000
It's early. The known risks are written
down in the repo, next to the code.

16
00:01:25,000 --> 00:01:32,000
Run your own, connect your agent through
MCP, and report any hole privately.
```

## Thumbnail text

**How an agent pays without a key.** (kicker: EXPLAINER) — `assets/day-05/thumb.png`

## Description

```
AI presenter. AgentGuard is open source (Apache-2.0) and self-hosted: there is no hosted service.
Early software: read the known risks in docs/final-report.md before you put money behind it.
Code: https://github.com/agent443-dot/AgentGuard
Self-host: https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md
Security reports, privately: https://github.com/agent443-dot/AgentGuard/security
```

## X post

```
AgentGuard in 90 seconds.

Your AI agent can pay x402 APIs without ever holding a key: your policy, a simulation of the exact payment, your OK on Telegram above a threshold, and an onchain daily cap underneath it all.

Open source, self-hosted, live on Robinhood Chain. Early, with the risks written down.
https://github.com/agent443-dot/AgentGuard
```

## Fact check

| Claim                                                         | Source                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| Open source, self-hosted, no hosted service                   | `LAUNCH.md` D7, D8; `site/index.html` FAQ               |
| Agent only asks; policy → simulation → approve / Telegram / reject | `README.md`, `SPEC.md` Goal                       |
| One yes covers one payment                                    | `site/index.html` "Human in the loop", `docs/final-report.md` |
| Vault owned by Phantom; Squads / Safe spend limit; worst day = cap + hot wallet | `README.md`, `docs/self-host.md`, `SECURITY.md` |
| `/kill` + one Phantom signature                               | `docs/self-host.md`, `LAUNCH.md` §4                     |
| Live on Robinhood Chain after a real-money pilot; Solana next; Base later | `README.md` Status, `LAUNCH.md` D6               |
| 895 tests, 39 attack cases                                    | `docs/final-report.md`, `site/index.html` stats         |
| Known risks written down                                      | `docs/final-report.md` Known risks                      |
