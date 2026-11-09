# Day 03 — How the onchain daily cap works

| Field         | Value                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| Date          | 2026-11-11 (Wednesday)                                                                        |
| Goal          | Explain the worst-case bound (cap + hot wallet) and why it holds even if guard-core fails     |
| Target viewer | Security-minded builders, people deciding whether to trust an agent with money                |
| Format        | Vertical 9:16, 1080×1920                                                                      |
| Length        | 60 s                                                                                          |
| Theme         | The onchain daily cap · what can go wrong (Safe chains)                                       |
| Status        | ready to record                                                                               |

## Hook (0–3 s)

**"What's the most your AI agent can lose in one day? With AgentGuard, you can write it down."**

## Scenes

| #   | Time      | Avatar narration (word for word)                                                                                                                         | On-screen text                                    | Visual                                                        | Transition |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- | ---------- |
| 1   | 0:00–0:04 | What's the most your AI agent can lose in one day? With AgentGuard, you can write it down.                                                               | `AI presenter` label                              | `01-hook.png` behind presenter                                | —          |
| 2   | 0:04–0:16 | Your money sits in a vault: a Squads multisig on Solana, a Safe on EVM chains. Only your Phantom wallet controls it. The agent's payments come from a small hot wallet. | Vault → cap → hot wallet            | `02-flow.png`, top two boxes, then the rest                   | push up    |
| 3   | 0:16–0:26 | The vault refills that hot wallet through a spend limit built into Squads or Safe. Audited code, already onchain. Never more than your daily cap.          | Built into Squads and Safe. No new contract.      | `02-flow.png`, zoom 105% on "Onchain daily cap"               | hard cut   |
| 4   | 0:26–0:36 | So the worst day is the cap, plus whatever sits in the hot wallet. That holds even if guard-core has a bug, or is compromised. The chain enforces it.     | Worst day = cap + hot wallet                      | `04-formula.png`                                              | crossfade  |
| 5   | 0:36–0:44 | At launch the cap is twenty a day per chain, and the hot wallet holds at most ten. Try your own numbers on the site.                                     | 20 + 10 = 30 per chain                            | `03-site-calculator.png`                                      | push up    |
| 6   | 0:44–0:55 | One honest detail. On Solana, the cap can only move into the hot wallet. On Safe chains, a stolen hot key could send the day's cap to any address. Same bound, different path. Keep the vault small. | Same bound, different path | `05-same-bound.png`, rows one by one              | hard cut   |
| 7   | 0:55–1:00 | The math and the risks are in the repo. Check them yourself.                                                                                              | github.com/agent443-dot/AgentGuard                | `06-cta.png`                                                  | crossfade  |

## Images

Rendered into `assets/day-03/`:

| File                     | Kind                | What it shows                                                                  |
| ------------------------ | ------------------- | ------------------------------------------------------------------------------ |
| `01-hook.png`            | card                | "The most your agent can lose in one day."                                     |
| `02-flow.png`            | diagram card        | Vault → onchain daily cap → hot wallet → x402 APIs                             |
| `03-site-calculator.png` | screenshot, `site/` | The site's loss calculator set to cap 20, hot wallet 10, vault 1,000 → $30. The vault value is illustrative |
| `04-formula.png`         | card                | Max loss per day = cap + hot wallet                                            |
| `05-same-bound.png`      | card                | Solana vs Safe chains: same bound, different path                              |
| `06-cta.png`             | end card            | Repo, self-host, private reports                                               |
| `thumb.png`              | thumbnail           | "Your worst day, capped onchain."                                              |

Optional screen recording: open `site/index.html` locally and drag the three sliders while the
presenter speaks scene 5. Keep the result box in frame.

No AI-generated images.

## Avatar direction

Energy 6/10, steady. Scene 2: hands apart at chest height for "vault", then a small pinch for
"small hot wallet". Scene 3: flat palm moving down and stopping on "never more than". Scene 4: a
single nod on "The chain enforces it". Scene 6: drop to 5/10, slower, direct eye contact; this is a
disclosure, not a twist.

## Captions (SRT)

```srt
1
00:00:00,000 --> 00:00:04,000
The most your AI agent can lose in a day?
With AgentGuard, you can write it down.

2
00:00:04,000 --> 00:00:10,000
Your money sits in a vault: Squads on
Solana, a Safe on EVM chains.

3
00:00:10,000 --> 00:00:16,000
Only your Phantom wallet controls it.
Payments come from a small hot wallet.

4
00:00:16,000 --> 00:00:21,000
The vault refills it through a spend
limit built into Squads or Safe.

5
00:00:21,000 --> 00:00:26,000
Audited code, already onchain.
Never more than your daily cap.

6
00:00:26,000 --> 00:00:31,000
Worst day: the cap, plus whatever
sits in the hot wallet.

7
00:00:31,000 --> 00:00:36,000
Even if guard-core is compromised.
The chain enforces it.

8
00:00:36,000 --> 00:00:40,000
At launch: 20 a day per chain,
at most 10 in the hot wallet.

9
00:00:40,000 --> 00:00:44,000
Try your own numbers on the site.

10
00:00:44,000 --> 00:00:50,000
On Solana, the cap only moves into the
hot wallet. On Safe chains, a stolen key

11
00:00:50,000 --> 00:00:55,000
could send the day's cap anywhere.
Same bound. Keep the vault small.

12
00:00:55,000 --> 00:01:00,000
The math and the risks are in the repo.
Check them yourself.
```

## Thumbnail text

**Your worst day, capped onchain.** (kicker: ONCHAIN DAILY CAP)

## X post

```
What's the most your AI agent can lose in a day?

With AgentGuard: the onchain daily cap + the hot wallet balance. Even if guard-core is compromised, because Squads (Solana) and the Safe Allowance Module (EVM) enforce the cap, not our code.

Launch: 20/day per chain.

One caveat we publish: on Safe chains a stolen hot key can send the day's cap to any address. Same bound, different path.
https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md
```

## CTA

Read the bound and the risks: `docs/final-report.md`, "Known risks" · Star the repo ·
Report vulnerabilities privately (`SECURITY.md`).

## Fact check

| Claim                                                                 | Source                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------- |
| Squads multisig on Solana, Safe on EVM, owned by the Phantom wallet    | `README.md`, `docs/self-host.md`                         |
| Spend limit is Squads Spending Limit / Safe Allowance Module, audited, no custom contract | `README.md`, `SPEC.md` Money flow   |
| Worst day = cap + hot wallet even if guard-core is compromised        | `docs/self-host.md`, `SECURITY.md`                       |
| 20 a day per chain; hot wallet at most 10                             | `LAUNCH.md` D1                                           |
| Solana: hot wallet is the only destination; Safe: any address         | `docs/final-report.md` Known risks #1, `LAUNCH.md` §1    |
| Keep the vault small                                                  | `docs/self-host.md`, `docs/final-report.md` Known risks #2 |
