# X playbook: answering people

AgentGuard sits between agents and money, so every reply is part of the security story. Transparency
is the brand: say what is true, say what is open, and point to the file that proves it.

## Principles

1. **Answer from the repository, not from memory.** Every answer should be checkable in `README.md`,
   `SPEC.md`, `docs/final-report.md`, `docs/security-review.md`, `docs/self-host.md`, `LAUNCH.md` or
   `SECURITY.md`. Link the file.
2. **Reply by hand.** No automated replies, no auto-DMs, no follow/unfollow tactics, no reply bots.
3. **Agree with the true part first.** Most criticism of a launch has a true part. Name it, then add
   what the design does about it.
4. **Never argue twice.** One clear, sourced answer. If they keep going, leave it; the record stands.
5. **No tagging to borrow credibility.** Do not tag Squads, Safe, Phantom, Robinhood, Solana,
   Anthropic or anyone else to imply a relationship. Mentioning a tool we use, by name, is fine.

## Criticism: common cases

| They say                                | Answer shape                                                                                                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Not audited, so it's unsafe"           | True that AgentGuard itself has no independent audit `[OWNER: confirm]`. The cap layer is audited Squads/Safe code and we wrote no contract. Our review is public. The worst day is bounded onchain. |
| "A software wallet as owner? Really?"   | Known risk #2, accepted on purpose for launch. Fresh phrase, used for nothing else, small vault. A Ledger path exists in the scripts but is proven only against a fake device.                       |
| "Self-hosting is too hard"              | Agree: it is a developer setup today. `docs/self-host.md` gives the order. No hosted service is planned in these posts; do not promise one.                                                          |
| "The delegate can send anywhere on EVM" | Correct, known risk #1. Same loss bound, wider path. That is one reason for the 20/day launch cap.                                                                                                   |
| "Prompt injection makes this pointless" | Limited, not solved. An injected agent can still only ask, and every request still meets the policy, the threshold and the cap.                                                                      |
| "Just use a card with a limit"          | Fair for many cases. AgentGuard is for agents paying x402 APIs and onchain transfers, where there is no card network to lean on.                                                                     |
| "This is AI-written code"               | AI sessions built it under written rules (`CLAUDE.md`), with tests, reviews and real-money runs by a person. Judge the code and the tests; both are public.                                          |
| "Another crypto grift"                  | No token, nothing to buy. Apache-2.0 code, self-hosted, risks listed. Invite them to read it.                                                                                                        |

## Security questions

- **Explain the bound, every time:** the most a day can cost is the daily cap plus the hot wallet
  balance, even if guard-core is compromised, because the cap is enforced onchain by Squads or the
  Safe Allowance Module.
- **Be exact about what is proven and where.** Robinhood Chain: live on mainnet, real money (HUMAN-21).
  Solana: devnet end to end, plus automated tests against the real Squads program. Base: Base Sepolia
  and a mainnet fork. Do not round "devnet" up to "mainnet".
- **Name the bugs we found.** The empty-hot-wallet simulation (#63), the stale bot on Fly (#118,
  #124), the dead Solana kill button (#116), the pre-release review's two high and six medium findings.
  Crediting real bugs builds more trust than any claim.
- **Never speculate about an attack in public.** If a question describes a plausible exploit, do not
  confirm, deny or debug it in the replies.

## When to say "we don't know yet"

Say it, in those words, when:

- the answer depends on something not run yet: the timed kill on Solana mainnet, Base mainnet, a
  Ledger on real hardware, Android deep links;
- someone asks for a date: Solana mainnet (until the owner confirms), Base, raising caps to 50, KMS;
- someone asks about scale, throughput or many guards: it is one process with SQLite today;
- the question is about a third party's code (Squads, Safe, x402 SDKs): point to their maintainers.

Template:

```text
We don't know yet. [What would answer it] hasn't been run. When it has, the result goes into [file], and we'll post it here.
```

## Pointing people to private vulnerability reporting

If a reply or DM hints at a way to move funds, bypass a policy, expose a key or token, or defeat the
kill switch:

1. Do not discuss details in public, and do not ask them to post more.
2. Reply once:

```text
Thank you. Please don't post details publicly. Report it privately on the repo: Security → Report a vulnerability. You'll get an answer within 72 hours.
https://github.com/agent443-dot/AgentGuard/security/advisories/new
```

3. Tell the owner (and the manager session) right away.
4. The policy in `SECURITY.md`: an answer within 72 hours; 90 days, or until a fix ships, before
   publishing; no paid bug bounty yet; reporters who want it are credited in the fix's release notes.
   Do not promise anything beyond that.

Make sure Private vulnerability reporting is enabled in the repository settings before launch, or
the link above will not work.

## What never to post

- **Secrets of any kind:** private keys, recovery phrases, agent tokens, admin or bot tokens,
  `.env` contents, Telegram bot tokens, API keys, RPC URLs with keys in them. Not in text, not in a
  screenshot, not blurred. Use placeholders or devnet values in visuals, and check every screenshot
  before posting.
- **A token, price, airdrop, points, rewards or "early supporter" perks.** CR-009 is only a proposal
  awaiting legal review. If someone asks: "No. AgentGuard is open-source software. There is nothing to
  buy."
- **Investment talk:** returns, "get in early", anything about value going up.
- **Hype words:** "unhackable", "100% safe", "guaranteed", "bulletproof", "revolutionary", "the
  first", "the only".
- **Numbers we don't have:** users, installs, volume, funds protected, stars as social proof. Use only
  figures from the source files, or real ones the owner provides.
- **Invented partners, quotes or endorsements,** and screenshots of other people's posts as praise
  without their consent.
- **Misleading media:** the site's intent feed and Telegram mock are illustrative; say so in alt text
  and never present them as real payments.
- **Live incident details** before the owner has acted: no "we're being attacked", no addresses under
  investigation. After the fix: what happened, what was lost (if anything), what changed.
- **Engagement bait:** "like if…", "RT to win", fake polls, giveaways.
- **Claims about Solana mainnet** before the owner confirms it is live.

## If something goes wrong

1. Owner runs the kill first (`LAUNCH.md`, "Kill, in order"). Posting comes after.
2. One short holding post, only if users could be affected: "We're investigating an issue with
   [component]. If you self-host, [the action to take, e.g. run /kill]. Details when we know them."
3. A follow-up with facts once known, linked to the fix.
4. Pause the scheduled calendar until then.
