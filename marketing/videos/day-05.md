# Day 05 — Explainer: how AgentGuard works, end to end

| Field         | Value                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Date          | 2026-11-13 (Friday)                                                                                 |
| Goal          | The one video to send someone who asks "what is AgentGuard?": the full path, the bound, the risks   |
| Target viewer | Developers and technical founders who will watch two to three minutes on YouTube or X              |
| Format        | Horizontal 16:9, 1920×1080 (weekly explainer, week 1)                                               |
| Length        | 2:50                                                                                                |
| Theme         | The problem · policy and simulation · Telegram approval · onchain cap · kill · self-host · known risks |
| Status        | ready to record                                                                                     |

## Hook (0–3 s)

**"This is how an AI agent pays for things without ever holding a key."**

## Scenes

Presenter on the left third; screens on the right two thirds unless noted.

| #   | Time      | Avatar narration (word for word)                                                                                                                                                                         | On-screen text                                   | Visual                                                  | Transition |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------- | ---------- |
| 1   | 0:00–0:08 | This is how an AI agent pays for things without ever holding a key. I'll go through the whole path in under three minutes: what happens, what the most is you can lose, and what can still go wrong.     | `AI presenter` label; lower-third `AgentGuard / OPEN SOURCE · SELF-HOSTED` | `01-title.png`                       | —          |
| 2   | 0:08–0:22 | AgentGuard sits between your agent and your money. It's open source, Apache two point oh, and self-hosted: there's no hosted service. You run your own copy. It's live on Robinhood Chain mainnet, with Solana next and Base later. | Open source · self-hosted · no hosted service | `02-site-hero.png`; keep "simulated example" visible  | push left  |
| 3   | 0:22–0:40 | It starts with a request. Your agent connects over M-C-P and asks to pay: an x402 API that charges per call, or a transfer. That's all it can do. Ask. It holds no key and no money.                     | Step 1 · Request                                 | `03-site-how.png`, crop on Step 1                       | hard cut   |
| 4   | 0:40–0:58 | Step two, policy. A new agent can't spend a cent until you allow it. You set a per-payment maximum, a daily maximum, the chains and tokens, and the exact recipients and websites it may pay. Any doubt means no. | Step 2 · Policy · deny-all by default    | `03-site-how.png`, crop on Step 2                       | hard cut   |
| 5   | 0:58–1:12 | Step three, a test run. Before anything is signed, AgentGuard simulates the exact payment and checks what it would really do: the balance changes, hidden permissions, programs you never approved.     | Step 3 · Simulation                              | `03-site-how.png`, crop on Step 3                       | hard cut   |
| 6   | 1:12–1:30 | Step four, decide. Under your threshold, it's approved. At or above it, it goes to you on Telegram with the real effect, not the agent's story. One yes covers one payment, once. No answer in ten minutes means no payment. | Step 4 · Approved · ask you · rejected | `06-site-approval.png`                                  | push left  |
| 7   | 1:30–1:52 | Now, the money. Your funds sit in a vault you control with your own Phantom wallet: a Squads multisig on Solana, a Safe on EVM chains. A spend limit built into Squads or Safe refills a small hot wallet, never above your daily cap. The agent pays from that. | Vault → daily cap → hot wallet | `04-site-money.png`                            | crossfade  |
| 8   | 1:52–2:06 | So the worst day is written down: the cap, plus whatever the hot wallet holds. That holds even if guard-core itself is compromised, because the chain enforces the cap. At launch it's twenty a day per chain. | Worst day = cap + hot wallet · 20/day per chain | `04-site-money.png`, zoom 105% on the calculator  | hard cut   |
| 9   | 2:06–2:20 | And if anything looks wrong: slash kill in Telegram pauses every agent. Then one signature in Phantom, on a signing page you host, removes the onchain limit.                                             | /kill + one Phantom signature                    | `05-site-security.png`, pan to "One-tap kill switch"    | push left  |
| 10  | 2:20–2:38 | What can still go wrong? On Safe chains, a stolen hot key can send the day's cap to any address. Your owner key lives in a software wallet, so keep the vault small. Your signing page is a trust root. And prompt injection through paid content is limited, not solved. | Known risks                          | `09-risks.png`, one row per sentence                    | hard cut   |
| 11  | 2:38–2:50 | It's early, and all of it is in the repo: the code, the tests, the risks. Connect your agent, or run your own guard, with the guides. And if you find a hole, report it privately.                        | github.com/agent443-dot/AgentGuard               | `08-site-developers.png` for 4 s, then `10-cta.png`     | crossfade  |

Optional insert at 0:16 (2 s): `07-site-chains.png` to show the three chains and their status.

## Images

Rendered into `assets/day-05/` (cards at 1920×1080; site shots at 1280 px CSS width, 2× scale):

| File                     | Kind                | What it shows                                              |
| ------------------------ | ------------------- | ---------------------------------------------------------- |
| `01-title.png`           | title card          | "How AgentGuard works, end to end."                        |
| `02-site-hero.png`       | screenshot, `site/` | Hero, with the "simulated example" feed                    |
| `03-site-how.png`        | screenshot          | The four steps                                             |
| `04-site-money.png`      | screenshot          | Where the money lives + loss calculator at 20 / 10 (vault value illustrative) |
| `05-site-security.png`   | screenshot          | Security model: six cards                                  |
| `06-site-approval.png`   | screenshot          | The site's example approval: "Pay 18.00 USDG" (an example, not a real payment) |
| `07-site-chains.png`     | screenshot          | Robinhood Chain live, Solana next, Base later              |
| `08-site-developers.png` | screenshot          | "Connect your agent. Run your own guard."                  |
| `09-risks.png`           | card                | Four known risks from `docs/final-report.md`               |
| `10-cta.png`             | end card            | Repo, self-host, private reports                           |
| `thumb.png`              | thumbnail 1920×1080 | "How an agent pays without a key." Export as JPG under 2 MB for YouTube |

No AI-generated images.

## Avatar direction

Energy 6/10 throughout, 5/10 on scene 10. Medium shot, presenter on the left third, facing slightly
toward the screen side. Count the four steps on the fingers as each begins (scenes 3–6). Scene 7:
both hands, one above the other, the lower one "refilled" by the upper. Scene 8: flat palm for the
cap. Scene 10: hands together, calm; no smile. Look back into the lens for the last sentence.

## Captions (SRT)

```srt
1
00:00:00,000 --> 00:00:04,000
This is how an AI agent pays for things
without ever holding a key.

2
00:00:04,000 --> 00:00:08,000
What happens, the most you can lose,
and what can still go wrong.

3
00:00:08,000 --> 00:00:15,000
AgentGuard sits between your agent and
your money. Open source, Apache-2.0.

4
00:00:15,000 --> 00:00:22,000
Self-hosted, no hosted service. Live on
Robinhood Chain; Solana next, Base later.

5
00:00:22,000 --> 00:00:31,000
Step one, a request. Your agent connects
over MCP and asks to pay.

6
00:00:31,000 --> 00:00:40,000
An x402 API, or a transfer. That's all
it can do. It holds no key and no money.

7
00:00:40,000 --> 00:00:48,000
Step two, policy. A new agent can't
spend a cent until you allow it.

8
00:00:48,000 --> 00:00:58,000
Per-payment and daily maximums, chains,
tokens, recipients, sites. Any doubt: no.

9
00:00:58,000 --> 00:01:05,000
Step three, a test run of the exact
payment, before anything is signed.

10
00:01:05,000 --> 00:01:12,000
Balance changes, hidden permissions,
programs you never approved.

11
00:01:12,000 --> 00:01:21,000
Step four, decide. Under your threshold:
approved. At or above: Telegram.

12
00:01:21,000 --> 00:01:30,000
One yes, one payment, once. No answer
in 10 minutes means no payment.

13
00:01:30,000 --> 00:01:41,000
Your funds sit in a vault your Phantom
wallet controls: Squads or a Safe.

14
00:01:41,000 --> 00:01:52,000
A built-in spend limit refills a small
hot wallet, never above your daily cap.

15
00:01:52,000 --> 00:01:59,000
Worst day: the cap plus the hot wallet,
even if guard-core is compromised.

16
00:01:59,000 --> 00:02:06,000
The chain enforces the cap.
At launch: 20 a day per chain.

17
00:02:06,000 --> 00:02:13,000
If anything looks wrong, /kill
pauses every agent.

18
00:02:13,000 --> 00:02:20,000
Then one Phantom signature on your own
page removes the onchain limit.

19
00:02:20,000 --> 00:02:29,000
On Safe chains, a stolen hot key can send
the day's cap anywhere. Keep vaults small.

20
00:02:29,000 --> 00:02:38,000
The signing page is a trust root. Prompt
injection is limited, not solved.

21
00:02:38,000 --> 00:02:44,000
It's early, and it's all in the repo:
code, tests, risks.

22
00:02:44,000 --> 00:02:50,000
Run your own guard. Report holes
privately.
```

## Thumbnail text

**How an agent pays without a key.** (kicker: EXPLAINER)

## X post

```
How an AI agent pays without ever holding a key, in under 3 minutes:

→ request over MCP
→ your policy (deny-all by default)
→ a simulation of the exact payment
→ approved, sent to you on Telegram, or rejected
→ paid from a hot wallet the chain caps daily
→ /kill + one Phantom signature to stop it

Plus the known risks, said out loud.
https://github.com/agent443-dot/AgentGuard
```

## CTA

Connect an agent: `packages/mcp-server/README.md` → "For agent builders" · Run your own:
`docs/self-host.md` · Report vulnerabilities privately (`SECURITY.md`).

## Fact check

| Claim                                                                        | Source                                                    |
| ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| Apache-2.0, self-hosted, no hosted service                                   | `LAUNCH.md` D7, D8; `site/index.html` FAQ                 |
| Robinhood Chain live, Solana next, Base later                                | `README.md`, `LAUNCH.md` D6                               |
| MCP tools `paid_fetch`, `transfer`                                           | `docs/final-report.md`, `packages/mcp-server/README.md`   |
| Deny-all, per-tx and daily limits, allowlists                                | `docs/final-report.md` "Across all chains", `SPEC.md` Policy |
| Simulation checks balance changes, hidden permissions, unknown programs      | `site/index.html` Step 3, `SPEC.md` reject codes          |
| Approvals expire after 10 minutes and are redeemed once                      | `site/index.html` Security model, `docs/final-report.md`  |
| Squads / Safe vault, built-in spend limit, worst day = cap + hot wallet       | `README.md`, `SECURITY.md`                                |
| 20 a day per chain                                                           | `LAUNCH.md` D1                                            |
| `/kill` + Phantom signature on the owner's page                              | `docs/self-host.md`, `LAUNCH.md` §4                       |
| The four risks                                                               | `docs/final-report.md` Known risks #1, #2, #3, #7         |
