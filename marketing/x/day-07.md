# Day 07 · Sunday 2026-11-15 · Known risks, and week one

Theme: the seven known risks, in public. Weekly recap.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md`

---

## 15:00 UTC · 12:00 BRT · Video, then thread · P2

```text
[VIDEO DAY 07]

Every security project has risks. Ours are written down in the final report, with what is still open. Thread below. 🧵
```

Caption for the video session: "The seven known risks, and what each one means for you."

Thread, as replies to the video post:

**1/9** · Image: `assets/day-07/01-known-risks.png`

```text
AgentGuard's seven known risks, straight from docs/final-report.md.

If you run it, you should know these before you fund a vault.
```

Alt text: Card titled "Seven known risks. Written down, not hidden." Seven rows: 1, Safe chains, a
stolen hot key can send the day's cap anywhere. 2, Owner key, in a software wallet, keep the vault
small. 3, Signing page, a trust root, deploy your own from your own main. 4, Rate limits, per socket
address, a proxy needs its own limit. 5, One process, SQLite and in-memory limits, off-volume backups
still open. 6, Lockfile, one high advisory not reachable from runtime. 7, Prompt injection, limited by
policy, not solved.

**2/9**

```text
1. On the Safe chains, a stolen hot key can send the day's cap to any address without guard-core seeing it.

On Solana it can only move the cap into the hot wallet. The loss bound is the same: cap + hot wallet balance.
```

**3/9**

```text
2. The owner key is in a software wallet. It can move the whole vault.

So: a fresh Phantom wallet with its own phrase, used for nothing else, and a vault that holds only what agents need for the coming days.
```

**4/9**

```text
3. The signing page is a trust root. Whoever can redeploy it can show a harmless summary of a harmful transaction.

That is why each user deploys their own, from their own protected main, with previews off.
```

**5/9**

```text
4. Rate limits count per socket address. Behind a proxy, every client shares the proxy's address, so the proxy needs its own per-client limit.
```

**6/9**

```text
5. One process, in-memory rate limits, SQLite. Fine for one guard.

The database is on a persistent volume with daily snapshots, and guard-core refuses an unsafe database location on mainnet. A backup schedule off the volume is still open.
```

**7/9**

```text
6. In the lockfile, not reachable from runtime: one high-severity advisory (bigint-buffer, through @solana/spl-token, no patch) and several moderate ones. Each is triaged in docs/security-review.md.
```

**8/9**

```text
7. Prompt injection through paid content is limited, not solved.

Tool output marks it as data, and every payment still needs the policy and, above the threshold, you. A model that ignores the marking can still ask to pay. It cannot pay more than the policy allows.
```

**9/9**

```text
If you see a risk that is not on this list, we want to hear it. Security issues privately, through the repo's Security tab; everything else as an issue.

https://github.com/agent443-dot/AgentGuard/blob/main/docs/final-report.md
```

---

## 19:00 UTC · 16:00 BRT · Weekly recap · P5

Image: `assets/day-07/02-week-1.png`

```text
Week one of AgentGuard, plainly:

• Live on Robinhood Chain mainnet, launch cap 20 a day
• Open source, self-hosted, no hosted service
• 895 tests, 39 attack cases
• Next: Solana mainnet, then Base

Thanks for every hard question. Keep them coming.
```

**If Solana went live this week**, replace the fourth bullet with: `• Solana mainnet live, Base next`
and re-render `day-07/02-week-1.png` with the "Next" row changed.

Alt text: Card titled "Week one, plainly." Rows: Live, Robinhood Chain mainnet, launch cap 20 a day.
Open, Apache-2.0, self-hosted, no hosted service. Tested, 895 automated tests, 39 attack cases. Next,
Solana mainnet, then Base. Before caps rise, 2–3 clean weeks, a timed kill, off-volume backups, KMS.

`[OWNER: if anything shipped or broke this week (a fix, a merged PR, a reported issue), add one line
for it. Real events only.]`

---

## Reply bank for Day 7

**"Why publish your risks? Isn't that bad marketing?"**

```text
Anyone who runs this should know them before funding a vault. A security tool that hides its weak spots is asking for blind trust. We would rather be trusted for what we wrote down.
```

**"When is the off-volume backup done?"**

```text
It is on the checklist before caps go from 20 to 50. We do not have a date. When it is done, it moves from "open" to "done" in LAUNCH.md, and we will say so here.
```

**"Is the bigint-buffer advisory a problem?"**

```text
Not from runtime, by our triage: only fixed-width u64 decoding reaches that package, and its native binding does not load. The reasoning is in docs/security-review.md if you want to check it.
```

**"Is prompt injection solved?"**

```text
No, and we do not claim it is. We limit what an injected agent can do: the policy, the allowlists, the threshold and the onchain cap all still apply.
```
