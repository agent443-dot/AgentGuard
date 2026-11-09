# Day 22 · Monday 2026-11-30 · Backups and the restore drill

Theme: a backup only counts once you restore it.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md`

---

## 13:30 UTC · 10:30 BRT · Video · P2

```text
[VIDEO DAY 22]

guard-core keeps your policies, today's spend and the audit log. Before launch we backed it up, restored it elsewhere, and checked it against the live guard.
```

Caption for the video session: "The restore drill, step by step."

---

## 16:00 UTC · 13:00 BRT · Build in public · P2

Image: `assets/day-22/01-restore.png`

```text
Our restore drill, before launch:

1. db:backup on the Fly machine
2. copied off with fly ssh sftp get
3. restore-drill opened it with the current code and migrations

Policy, today's spend, both executed intents and all 15 audit events matched the live guard.
```

Alt text: Diagram titled "A backup only counts once you restore it." Step 1, db:backup on the machine,
a 72 KB file. Arrow: fly ssh sftp get to the owner machine, mode 0600. Step 2, restore-drill, opened
with the current code and migrations. Arrow: compared with the live guard. Step 3, all matched:
policy, today's spend, both executed intents, all 15 audit events.

Reply to self:

```text
Still open, and listed as known risk #5: a backup schedule that copies the database off the volume. Fly snapshots it daily; a copy elsewhere is the next step.

Run your own drill: self-host guide, step 7.
https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
When did you last restore a backup, not just take one?

For anything that tracks money, we now count a backup as real only after a restore drill.
```

---

## Reply bank for Day 22

**"What happens to today's spend after a restart?"**

```text
It survives. In the deployment review, spentToday read 500000 before and after a machine restart.
```

**"Why SQLite?"**

```text
One guard, one process: SQLite on a persistent volume is simple and enough. It is known risk #5, and guard-core refuses to start on mainnet with an unsafe database location.
```

**"How long are snapshots kept?"**

```text
Fly's default in our setup was 5 days. fly volumes update <id> --snapshot-retention 14 keeps two weeks.
```
