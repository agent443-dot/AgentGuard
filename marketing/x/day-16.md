# Day 16 · Tuesday 2026-11-24 · No floats for money

Theme: bigint amounts and the audit log.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/SPEC.md`

---

## 13:30 UTC · 10:30 BRT · Video · P1

```text
[VIDEO DAY 16]

Every decision AgentGuard makes goes into an audit log with its exact reason. Amounts are exact to a millionth of a dollar and never rounded.
```

Caption for the video session: "The audit log: what your agent tried, and why it was stopped."

---

## 15:00 UTC · 12:00 BRT · Thread: no floats for money · P1

**1/5** · Image: `assets/day-16/01-bigint.png`

```text
A small rule with big consequences in AgentGuard: no floats for money, anywhere. 🧵
```

Alt text: Code card titled "No floats for money. Ever." The agent sends amountUsd "0.25" as a decimal
string; the guard stores amount "250000" in atomic units as a bigint. Refused, never rounded: 0.25 as a
JSON number, "-1", "1e3", "NaN", "0.1234567". Footer: every decision goes to the audit log with its
reasons, exact to a millionth of a dollar.

**2/5**

```text
An agent sends amounts as decimal strings like "0.25", never JSON numbers. A number has already been through a float by the time it arrives.

A sign, an exponent, NaN, Infinity, or more than 6 decimal places is refused, not rounded.
```

**3/5**

```text
Inside guard-core, amounts are atomic units of the chain's dollar: 6 decimals, kept as bigint.

USDC on Solana and Base, USDG on Robinhood Chain. Both have 6 decimals, so "0.25" means the same everywhere.
```

**4/5**

```text
Every decision is written to the audit log with its reasons: approved, pending, rejected with which codes, executed with which transaction.

In our restore drill, all 15 audit events came back and matched the live guard.
```

**5/5**

```text
The types, the reject codes and the rules every package follows:

https://github.com/agent443-dot/AgentGuard/blob/main/SPEC.md
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
Have you ever shipped a float-for-money bug? 0.1 + 0.2 in a payment path, a rounding drift in a balance?

No judgment. Most of us have. That is why amounts here are strings at the edge and bigints inside.
```

---

## Reply bank for Day 16

**"Why not a decimal library?"**

```text
For a fixed 6-decimal dollar, atomic units in a bigint are exact and simple, and there is nothing to configure wrong. Parsing happens once, at the boundary, with zod.
```

**"Where is the audit log stored?"**

```text
In guard-core's SQLite database, on a persistent encrypted volume in the Fly setup, with daily snapshots. A backup schedule off the volume is still open.
```

**"Can the agent read the audit log?"**

```text
No. It can read its own intents and its budget. The full log is the owner's.
```
