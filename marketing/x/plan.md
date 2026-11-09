# AgentGuard on X: 30-day plan

Day 1 is Monday 2026-11-09, launch day: the repository goes public and AgentGuard is live on Robinhood
Chain mainnet. Solana mainnet is planned for Day 2 and is written as "next" everywhere until the owner
confirms it is live. Base comes later.

Every claim in these drafts comes from `README.md`, `docs/final-report.md`, `docs/self-host.md`,
`docs/security-review.md`, `LAUNCH.md`, `SECURITY.md`, `SPEC.md`, `site/index.html` or
`packages/mcp-server/README.md`. If a post needs a fact that is not in those files, it gets a
`[OWNER: …]` placeholder rather than a guess.

## Cadence

**Weekdays, 3 posts:** one video or visual, one technical or build-in-public post, one short
engagement post. **Weekends, 2 posts:** the video and one light post. **A thread every 2–3 days,** in
place of that day's technical post. **A weekly recap every Sunday.**

Why:

- **Three a day is enough to be seen and few enough to stay good.** Three posts reach the US and EU
  time zones without repeating content. More than that, at launch, tends to read as noise and makes
  it hard to answer replies, and replies are where developer trust gets built.
- **The video is the daily anchor.** One video a day is already planned, so every day has a reason to
  exist. Technical posts go deeper on that day's subject.
- **Threads carry the security argument.** "Worst day = cap + hot wallet" and the known risks need
  more than 280 characters. A thread every 2–3 days keeps that depth without tiring people out.
- **Engagement posts are real questions,** not bait. They ask builders how they handle agent spending
  today, and the answers shape the FAQ banks.
- **Lighter weekends:** developer reach drops on Saturdays and Sundays. The Sunday recap is the
  exception, because people catch up then.
- **Reply time is part of the cadence:** for 30–45 minutes after each post, answer by hand. Never
  automate replies (X's rules, and `playbook.md`).

## Posting times

US/EU developer audience. In November the US is on standard time (ET = UTC−5, PT = UTC−8) and the EU
on winter time (CET = UTC+1). Brasília is UTC−3 all year.

| Slot      | UTC   | Brasília | US East | Central EU | Use                                                       |
| --------- | ----- | -------- | ------- | ---------- | --------------------------------------------------------- |
| A, main   | 13:30 | 10:30    | 08:30   | 14:30      | Video or visual. EU afternoon and US morning overlap      |
| B, tech   | 16:00 | 13:00    | 11:00   | 17:00      | Technical or build-in-public. US late morning, EU evening |
| Thread    | 15:00 | 12:00    | 10:00   | 16:00      | Replaces B on thread days                                 |
| C, talk   | 20:00 | 17:00    | 15:00   | 21:00      | Engagement. US afternoon, US West at lunch                |
| Weekend   | 15:00 | 12:00    | 10:00   | 16:00      | Video                                                     |
| Weekend 2 | 19:00 | 16:00    | 14:00   | 20:00      | Light post or Sunday recap                                |

Tuesday to Thursday, 13:00–17:00 UTC, is the strongest window for developer content. That is why the
big threads fall on those days when possible.

## Content pillars

| #   | Pillar             | What it covers                                                                 | Share |
| --- | ------------------ | ------------------------------------------------------------------------------ | ----- |
| P1  | How it works       | Money flow, policy → simulation → approval, the onchain cap, the kill          | 30%   |
| P2  | Proof, in the open | The mainnet pilot, test runs, bugs found and fixed, known risks, what is open  | 25%   |
| P3  | For builders       | MCP tools, connecting Claude and other clients, self-hosting, x402             | 25%   |
| P4  | Threat model       | Reject codes, attack cases, prompt injection, the signing page as a trust root | 15%   |
| P5  | Conversation       | Questions to builders, AMA prompts, weekly recaps                              | 5%    |

## Launch day: Monday 2026-11-09

Before the first post:

1. The repository's default branch is still `claude/agentguard-setup-smlps6` (README, "Branches"). A
   visitor from X would land on the wrong branch. **Switch the default branch to `main` first**, or
   use only `/tree/main` and `/blob/main/` links. These drafts use `/tree/main` for the repository.
2. Check that **Private vulnerability reporting** is on (Settings → Code security), because
   `SECURITY.md` and every security answer point to it.
3. Set up the profile (`profile.md`).

The sequence (all in `day-01.md`):

| UTC   | Brasília | Post                                                                | Notes                                   |
| ----- | -------- | ------------------------------------------------------------------- | --------------------------------------- |
| 13:00 | 10:00    | Announcement thread, 8 posts. **Pin it**                            | Images on 1/, 3/ and 5/                 |
| 13:45 | 10:45    | `[VIDEO DAY 01]`, quoting the pinned thread                         |                                         |
| 16:00 | 13:00    | Build in public: the real `pnpm test` output, 895 passing           | Image: terminal card                    |
| 18:00 | 15:00    | Proof: the mainnet pilot, one payment and the kill, read from chain | Image: pilot card                       |
| 20:30 | 17:30    | Engagement: "what should an agent never be able to pay for?"        |                                         |
| 22:30 | 19:30    | No new post. Answer replies, then a short reply-to-self thank-you   | Only if there were replies to thank for |

If launch starts late, keep the order and the gaps, and shift the whole block.

## 30-day calendar

Types: **V** video, **Vis** visual, **T** technical, **BIP** build in public, **Th** thread, **E**
engagement, **R** recap. Times are UTC; add −3h for Brasília.

| Day | Date      | UTC   | Type     | Pillar | Hook                                                                         |
| --- | --------- | ----- | -------- | ------ | ---------------------------------------------------------------------------- |
| 1   | Mon 11-09 | 13:00 | Th (pin) | P1     | AgentGuard is public: your agent can spend, it never holds the key           |
| 1   | Mon 11-09 | 13:45 | V        | P1     | [VIDEO DAY 01]: what AgentGuard is, in one minute                            |
| 1   | Mon 11-09 | 16:00 | BIP      | P2     | 895 tests, real output, all passing                                          |
| 1   | Mon 11-09 | 18:00 | Vis      | P2     | The mainnet pilot: 0.50 USDG paid over x402, then the kill                   |
| 1   | Mon 11-09 | 20:30 | E        | P5     | What should an agent never be able to pay for?                               |
| 2   | Tue 11-10 | 13:30 | V        | P1     | [VIDEO DAY 02]: Solana (live or next, owner confirms)                        |
| 2   | Tue 11-10 | 15:00 | Th       | P4     | Same promise, two mechanisms: Squads vs the Safe Allowance Module            |
| 2   | Tue 11-10 | 20:00 | E        | P5     | Your agent's per-payment limit today. "None" is an answer                    |
| 3   | Wed 11-11 | 13:30 | V        | P3     | [VIDEO DAY 03]: the agent never holds a key                                  |
| 3   | Wed 11-11 | 16:00 | T        | P3     | Connect Claude Code in one command                                           |
| 3   | Wed 11-11 | 18:00 | Vis      | P3     | Four tools. None returns a key, none changes a limit                         |
| 3   | Wed 11-11 | 20:00 | E        | P5     | How do your agents pay for APIs today?                                       |
| 4   | Thu 11-12 | 13:30 | V        | P1     | [VIDEO DAY 04]: the test run before signing                                  |
| 4   | Thu 11-12 | 15:00 | Th       | P4     | Twenty ways to say no: every reject code has a name                          |
| 4   | Thu 11-12 | 20:00 | E        | P5     | Which reject code would you hit first?                                       |
| 5   | Fri 11-13 | 13:30 | V        | P1     | [VIDEO DAY 05]: big payments wait for your thumb                             |
| 5   | Fri 11-13 | 16:00 | BIP      | P2     | A bug live runs found: an empty hot wallet could never pay (#63)             |
| 5   | Fri 11-13 | 20:00 | E        | P5     | Approve the effect, not the agent's story                                    |
| 6   | Sat 11-14 | 15:00 | V        | P1     | [VIDEO DAY 06]: /kill and one Phantom signature                              |
| 6   | Sat 11-14 | 19:00 | Vis      | P1     | The kill, as run on mainnet                                                  |
| 7   | Sun 11-15 | 15:00 | V + Th   | P2     | [VIDEO DAY 07] + thread: seven known risks, in writing                       |
| 7   | Sun 11-15 | 19:00 | R        | P5     | Week one, plainly                                                            |
| 8   | Mon 11-16 | 13:30 | V        | P3     | [VIDEO DAY 08]: run your own AgentGuard                                      |
| 8   | Mon 11-16 | 16:00 | T        | P3     | Self-hosting: what you need before you start                                 |
| 8   | Mon 11-16 | 20:00 | E        | P5     | What stops you from self-hosting infra like this?                            |
| 9   | Tue 11-17 | 13:30 | V        | P3     | [VIDEO DAY 09]: x402, pay-per-use APIs                                       |
| 9   | Tue 11-17 | 15:00 | Th       | P4     | Paid content is data, not instructions: prompt injection, limited not solved |
| 9   | Tue 11-17 | 20:00 | E        | P5     | Would you let an agent buy API calls on its own under $1?                    |
| 10  | Wed 11-18 | 13:30 | V        | P2     | [VIDEO DAY 10]: the pre-release review                                       |
| 10  | Wed 11-18 | 16:00 | BIP      | P2     | Two high, six medium, all fixed with tests before going public               |
| 10  | Wed 11-18 | 20:00 | E        | P5     | Ask us anything about the review                                             |
| 11  | Thu 11-19 | 13:30 | V        | P1     | [VIDEO DAY 11]: the Safe Allowance Module                                    |
| 11  | Thu 11-19 | 15:00 | Th       | P1     | Why there is no custom contract                                              |
| 11  | Thu 11-19 | 20:00 | E        | P5     | Check the token address, not the name (USDG)                                 |
| 12  | Fri 11-20 | 13:30 | V        | P4     | [VIDEO DAY 12]: the signing page is a trust root                             |
| 12  | Fri 11-20 | 16:00 | T        | P4     | Why you deploy your own signing page, from your own main                     |
| 12  | Fri 11-20 | 20:00 | E        | P5     | Where do you sign your most sensitive transactions?                          |
| 13  | Sat 11-21 | 15:00 | V        | P3     | [VIDEO DAY 13]: a new agent cannot spend a cent                              |
| 13  | Sat 11-21 | 19:00 | T        | P3     | A sensible first policy: 5 per payment, 20 a day, approve above 1            |
| 14  | Sun 11-22 | 15:00 | V        | P2     | [VIDEO DAY 14]: week two                                                     |
| 14  | Sun 11-22 | 19:00 | R + Th   | P5     | Week two recap thread                                                        |
| 15  | Mon 11-23 | 13:30 | V        | P4     | [VIDEO DAY 15]: the attack suite                                             |
| 15  | Mon 11-23 | 16:00 | Vis      | P4     | 39 attack cases: Permit, EIP-7702, SPL Approve, hidden accounts              |
| 15  | Mon 11-23 | 20:00 | E        | P5     | Which attack should we add as case 40?                                       |
| 16  | Tue 11-24 | 13:30 | V        | P1     | [VIDEO DAY 16]: the audit log                                                |
| 16  | Tue 11-24 | 15:00 | Th       | P1     | No floats for money: bigint, exact to a millionth of a dollar                |
| 16  | Tue 11-24 | 20:00 | E        | P5     | Have you ever lost cents to float rounding?                                  |
| 17  | Wed 11-25 | 13:30 | V        | P1     | [VIDEO DAY 17]: approvals expire and are redeemed once                       |
| 17  | Wed 11-25 | 16:00 | T        | P1     | One yes, one payment: what an approval covers                                |
| 17  | Wed 11-25 | 20:00 | E        | P5     | What is your approval threshold?                                             |
| 18  | Thu 11-26 | 13:30 | V        | P2     | [VIDEO DAY 18]: what is still open                                           |
| 18  | Thu 11-26 | 15:00 | Th       | P2     | The open low findings, listed                                                |
| 18  | Thu 11-26 | 20:00 | E        | P5     | Light: holiday in the US, one short question                                 |
| 19  | Fri 11-27 | 13:30 | V        | P4     | [VIDEO DAY 19]: the bot only listens to you                                  |
| 19  | Fri 11-27 | 16:00 | T        | P4     | HMAC-signed hooks, replays refused, owners only                              |
| 19  | Fri 11-27 | 20:00 | E        | P5     | A stale kill button we found and fixed                                       |
| 20  | Sat 11-28 | 15:00 | V        | P3     | [VIDEO DAY 20]: handling pending_approval                                    |
| 20  | Sat 11-28 | 19:00 | T        | P3     | What your agent should do while it waits                                     |
| 21  | Sun 11-29 | 15:00 | V        | P2     | [VIDEO DAY 21]: before caps rise                                             |
| 21  | Sun 11-29 | 19:00 | R + Th   | P2     | Week three recap and the checklist to go from 20 to 50                       |
| 22  | Mon 11-30 | 13:30 | V        | P2     | [VIDEO DAY 22]: backups and the restore drill                                |
| 22  | Mon 11-30 | 16:00 | BIP      | P2     | We restored a backup and checked it against the live guard                   |
| 22  | Mon 11-30 | 20:00 | E        | P5     | When did you last test a restore?                                            |
| 23  | Tue 12-01 | 13:30 | V        | P4     | [VIDEO DAY 23]: rate limits behind a proxy                                   |
| 23  | Tue 12-01 | 15:00 | Th       | P4     | 130 requests with forged client IPs, still limited                           |
| 23  | Tue 12-01 | 20:00 | E        | P5     | Do you trust X-Forwarded-For?                                                |
| 24  | Wed 12-02 | 13:30 | V        | P2     | [VIDEO DAY 24]: the owner key                                                |
| 24  | Wed 12-02 | 16:00 | T        | P2     | A software wallet owner: the three conditions, and why the vault stays small |
| 24  | Wed 12-02 | 20:00 | E        | P5     | Hardware wallet or software wallet for an owner key?                         |
| 25  | Thu 12-03 | 13:30 | V        | P1     | [VIDEO DAY 25]: the life of one payment                                      |
| 25  | Thu 12-03 | 15:00 | Th       | P1     | One intent from request to receipt, from the pilot                           |
| 25  | Thu 12-03 | 20:00 | E        | P5     | What would you log for every agent payment?                                  |
| 26  | Fri 12-04 | 13:30 | V        | P4     | [VIDEO DAY 26]: how to report a vulnerability                                |
| 26  | Fri 12-04 | 16:00 | T        | P4     | Private reporting, an answer within 72 hours, credit in the release notes    |
| 26  | Fri 12-04 | 20:00 | E        | P5     | What should we review next?                                                  |
| 27  | Sat 12-05 | 15:00 | V        | P2     | [VIDEO DAY 27]: Base, where it stands                                        |
| 27  | Sat 12-05 | 19:00 | T        | P2     | Tested on Base Sepolia; what is left before mainnet                          |
| 28  | Sun 12-06 | 15:00 | V        | P2     | [VIDEO DAY 28]: week four                                                    |
| 28  | Sun 12-06 | 19:00 | R        | P5     | Week four recap                                                              |
| 29  | Mon 12-07 | 13:30 | V        | P3     | [VIDEO DAY 29]: one agent, start to finish                                   |
| 29  | Mon 12-07 | 16:00 | T        | P3     | From clone to a first paid call: the order of the steps                      |
| 29  | Mon 12-07 | 20:00 | E        | P5     | What would make you try it this week?                                        |
| 30  | Tue 12-08 | 13:30 | V        | P2     | [VIDEO DAY 30]: thirty days                                                  |
| 30  | Tue 12-08 | 15:00 | Th       | P2     | 30 days in the open: what held, what we fixed, what is next                  |
| 30  | Tue 12-08 | 20:00 | E        | P5     | Tell us what to build next                                                   |

## Rules that apply to every day

- Never mention a token, price, airdrop, points or rewards (CR-009 is only a proposal). See
  `playbook.md`.
- Use "Solana next" until the owner confirms Solana mainnet is live. Each day file marks the posts
  that change once it is.
- Numbers only from the source files. No follower, user or volume figures unless the owner gives real
  ones.
- At most 2 hashtags, and only where they help discovery: `#AIagents`, `#x402`, `#MCP`, `#Solana`.
- Run `node marketing/x/assets/_src/check.cjs` after editing a day file: it checks every post is
  within 280 characters (URLs count as 23) and flags banned words.
- Images: `node marketing/x/assets/_src/render.cjs day-NN` re-renders a day's cards and site shots.
