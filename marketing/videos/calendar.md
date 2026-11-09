# 30-day video calendar

One video a day from launch, 2026-11-09 to 2026-12-08. Vertical 9:16 (X, Shorts, Reels) unless
marked **16:9**: one horizontal explainer each week, on Fridays. Recaps on Sundays.

Style, tone and the "never say" list: [`style-guide.md`](./style-guide.md). Every claim must trace to
the source files listed there. Solana is "next" in every script until the owner confirms it is live;
Base is "later".

Status: **ready** = script and images done · **planned** = topic and hook set, script to write ·
**recorded** / **published** = set by the owner.

| Day | Date        | Title                                         | Goal                                                         | Format | Length | Hook (0–3 s)                                                              | CTA                                    | Status  |
| --- | ----------- | --------------------------------------------- | ------------------------------------------------------------ | ------ | ------ | ------------------------------------------------------------------------- | -------------------------------------- | ------- |
| 1   | Mon 11-09   | [Open source, live on Robinhood Chain](./day-01.md) | Announce the public repo and what AgentGuard is        | 9:16   | 52 s   | "Your AI agent can pay for things now. It never holds a key."             | Star the repo · self-host · report privately | ready |
| 2   | Tue 11-10   | [The problem: an agent with a key](./day-02.md) | Make the risk of an agent holding a key obvious            | 9:16   | 52 s   | "Would you hand an AI agent your private key?"                            | Read the code, run your own            | ready   |
| 3   | Wed 11-11   | [How the onchain daily cap works](./day-03.md) | Explain worst day = cap + hot wallet, and the Safe caveat   | 9:16   | 60 s   | "What's the most your AI agent can lose in one day?"                       | Read the known risks                   | ready   |
| 4   | Thu 11-12   | [The kill switch](./day-04.md)                | Show `/kill` + one Phantom signature, in order               | 9:16   | 62 s   | "Your agent is doing something you didn't expect. Here's how you stop it." | Rehearse the kill (self-host guide)    | ready   |
| 5   | Fri 11-13   | [Explainer: how AgentGuard works](./day-05.md) | The one video to send someone who asks "what is it?"       | **16:9** | 2:50 | "This is how an AI agent pays for things without ever holding a key."     | MCP docs · self-host · report privately | ready  |
| 6   | Sat 11-14   | [The real-money pilot](./day-06.md)           | Proof on mainnet: 0.50 USDG over x402, then the kill         | 9:16   | 60 s   | "Before launch, we ran AgentGuard with real money. Fifty cents of it."    | Read the pilot record                  | ready   |
| 7   | Sun 11-15   | [Week 1, in public](./day-07.md)              | Recap: shipped, open, before caps rise                       | 9:16   | 55 s   | "Week one of AgentGuard in public. What shipped, and what's still open."  | Watch the repo, hold us to it          | ready   |
| 8   | Mon 11-16   | x402: pay-per-use, through the guard          | Walk one paid API call: 402 → policy → simulation → pay → data | 9:16 | 55 s   | "Your agent hits an API that says: pay fifty cents first. What happens?"  | MCP docs for agent builders            | planned |
| 9   | Tue 11-17   | Solana: the Squads spending limit             | How the cap works on Solana; live or next per the owner      | 9:16   | 55 s   | "On Solana, the daily cap has exactly one place it can send money."       | Self-host guide, Solana section        | planned (confirm Solana status) |
| 10  | Wed 11-18   | Your policy: deny-all first                   | The policy fields and a sensible start (5 / 20 / approval above 1) | 9:16 | 50 s | "A new agent in AgentGuard can't spend a cent. That's the default."       | SPEC.md Policy · self-host step 6      | planned |
| 11  | Thu 11-19   | Approve the effect, not the story             | Telegram approvals: real effect, one yes = one payment, 10-min expiry | 9:16 | 50 s | "Your agent says it's buying market data. Should you believe it?"      | Star the repo                          | planned |
| 12  | Fri 11-20   | Explainer: self-host in seven steps           | From an empty account to a capped agent and a working kill   | **16:9** | 3:00 | "There's no AgentGuard service to sign up for. Here's how you run your own." | docs/self-host.md                   | planned |
| 13  | Sat 11-21   | The pre-release review: what it fixed         | Two high and six medium findings, each fixed with a test     | 9:16   | 60 s   | "Before going public, we reviewed every package. Here's what we found."   | docs/security-review.md · report privately | planned |
| 14  | Sun 11-22   | Week 2, in public                             | Recap: what changed, what's open, any incidents (or none)    | 9:16   | 55 s   | "Week two. Here's what moved, and what didn't."                           | Watch the repo                         | planned |
| 15  | Mon 11-23   | MCP for agent builders: four tools            | `transfer`, `paid_fetch`, `check_intent`, `get_budget`       | 9:16   | 60 s   | "Your agent gets four tools. None of them touch a key."                   | MCP README, "For agent builders"       | planned |
| 16  | Tue 11-24   | What can go wrong, part 1: keys               | Stolen hot key on Safe chains; owner key in a software wallet | 9:16  | 60 s   | "Here are two ways AgentGuard can still lose you money."                  | docs/final-report.md Known risks       | planned |
| 17  | Wed 11-25   | Twenty ways to say no                         | Reject codes: policy, Solana and EVM detections               | 9:16  | 50 s   | "Every refused payment comes with a reason. There are twenty."            | SPEC.md reject codes                   | planned |
| 18  | Thu 11-26   | Tests and CI                                  | 895 tests, what CI runs, what only a person ran               | 9:16  | 55 s   | "895 tests run on every change. Here's what they don't cover."            | Star the repo · contribute             | planned |
| 19  | Fri 11-27   | Explainer: the security model                 | Two layers that don't trust each other, and every known risk | **16:9** | 3:00 | "Assume our software is compromised. What does that cost you?"           | SECURITY.md · report privately         | planned |
| 20  | Sat 11-28   | FAQ 1: the vault and a compromised guard      | Can the agent touch the vault? What if AgentGuard is hacked? | 9:16   | 45 s   | "Two questions everyone asks first."                                       | Site FAQ · star the repo               | planned |
| 21  | Sun 11-29   | Week 3, in public                             | Recap, progress on "Before raising caps"                     | 9:16   | 55 s   | "Week three. Two of the five checkboxes, or not yet?"                     | Watch the repo                         | planned |
| 22  | Mon 11-30   | The attack suite: 39 cases                    | Three attacks the suite throws, and the code that stops each | 9:16   | 60 s   | "We attack AgentGuard 39 ways on every change. Here are three."           | e2e/ · report privately                | planned |
| 23  | Tue 12-01   | What can go wrong, part 2                     | Signing page as trust root; prompt injection; rate limits behind a proxy | 9:16 | 60 s | "Three more risks we'd rather you hear from us."                   | docs/final-report.md Known risks       | planned |
| 24  | Wed 12-02   | For builders: `pending_approval`              | How an agent waits for the owner and repeats the request     | 9:16   | 50 s   | "Your agent asked to pay, and the answer is: wait."                       | MCP README, "Handling pending_approval" | planned |
| 25  | Thu 12-03   | Before you rely on it: three drills           | A small payment, the kill, a backup restore                  | 9:16   | 60 s   | "Don't trust a kill switch you've never pressed."                         | docs/self-host.md §7                   | planned |
| 26  | Fri 12-04   | Explainer: connect an agent with MCP          | Claude Code + MCP + a paid API on devnet, end to end         | **16:9** | 3:00 | "Let's connect an agent and watch it pay, without a key."                 | MCP docs for agent builders            | planned |
| 27  | Sat 12-05   | FAQ 2: hosting, tokens, the agent's reason    | Do you run it for me? Which dollars? Does the reason matter? | 9:16   | 45 s   | "Three short answers. The first one is no."                               | Site FAQ                               | planned |
| 28  | Sun 12-06   | Week 4, in public                             | Recap; cap decision status from the checklist                | 9:16   | 55 s   | "Four weeks on mainnet. Do caps go up?"                                   | Watch the repo                         | planned |
| 29  | Mon 12-07   | The roadmap, plainly                          | Caps, KMS, backups, Base and its own pilot                   | 9:16   | 50 s   | "Here's what comes next, and what has to be true first."                  | LAUNCH.md                              | planned |
| 30  | Tue 12-08   | Month one: build it with us                   | How to contribute, review, and report vulnerabilities        | 9:16   | 60 s   | "A month of AgentGuard in public. Here's how to help."                    | Star · contribute · report privately   | planned |

## Theme coverage

| Theme                                   | Days            |
| --------------------------------------- | --------------- |
| The problem: agents with wallets         | 1, 2            |
| The onchain daily cap                   | 3, 9            |
| Kill switch: Telegram + one Phantom signature | 4, 25     |
| x402 pay-per-use                        | 8, 26           |
| Real-money Robinhood Chain pilot        | 6               |
| Solana mainnet going live               | 9 (and swap lines in 2, 7) |
| Self-host in steps                      | 12, 25          |
| Pre-release security review             | 13              |
| What can go wrong (known risks)         | 3, 16, 23 (and in 5, 19) |
| Tests and CI                            | 7, 18, 22       |
| MCP for agent builders                  | 15, 24, 26      |
| Policy and approvals                    | 10, 11, 17      |
| FAQs                                    | 20, 27          |
| Weekly build-in-public recap            | 7, 14, 21, 28, 30 |
| Weekly 16:9 explainer                   | 5, 12, 19, 26   |

## Before each recording

1. Re-read the script against the source files; numbers change (tests, caps, chain status).
2. Ask the owner whether Solana mainnet is live. Use the swap lines only on a yes.
3. Re-render the day's images: `node marketing/videos/assets/src/render.cjs day-NN`.
4. Put "AI presenter." at the top of the description (block in `style-guide.md`).
