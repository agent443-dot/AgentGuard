# Day 26 · Friday 2026-12-04 · How to report a vulnerability

Theme: private reporting, and what to expect.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/SECURITY.md`

---

## 13:30 UTC · 10:30 BRT · Video · P4

```text
[VIDEO DAY 26]

AgentGuard sits between agents and money, so security reports are the most important issues we get. If you break something, here is how to tell us without telling everyone.
```

Caption for the video session: "How to report a vulnerability, and what happens next."

---

## 16:00 UTC · 13:00 BRT · Technical · P4

Image: `assets/day-26/01-report.png`

```text
Found a way to move funds, bypass a policy, expose a key or defeat the kill switch in AgentGuard?

Report it privately: Security → Report a vulnerability on the repo.
• an answer within 72 hours
• 90 days before publishing, or until a fix ships
• credit if you want it
```

Alt text: Card titled "Found a hole? Tell us privately." Rows: Where, Security, Report a vulnerability,
on the repository. Answer, within 72 hours. Disclosure, 90 days, or until a fix ships if sooner. Credit,
in the fix's release notes, if you want it. Bounty, no paid bounty yet.

Reply to self:

```text
No paid bug bounty yet, and we won't pretend otherwise. In scope: everything in the repo. Out of scope: Squads, Safe and the Allowance Module themselves, an attacker who has the owner's wallet, and DoS by volume.

https://github.com/agent443-dot/AgentGuard/blob/main/SECURITY.md
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
If you were reviewing AgentGuard for an afternoon, where would you start?

The signing page, the x402 retry, the Solana transaction inspection, the bot's hooks? We'd like to know where outside eyes go first.
```

---

## Reply bank for Day 26

**"Why no bounty?"**

```text
It is an early open-source project with no funding for one. We'd rather say that than promise money we can't pay. Reporters are credited in the fix's release notes if they want.
```

**"Can I post my finding after it's fixed?"**

```text
Yes. We ask for 90 days, or until a fix ships if sooner. After that it's yours to publish.
```

**"I found something minor, not a vulnerability."**

```text
A public issue is perfect for that. Private reporting is for anything that could move funds, bypass a policy, expose a secret or defeat the kill.
```
