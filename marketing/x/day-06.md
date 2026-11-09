# Day 06 · Saturday 2026-11-14 · The kill switch

Theme: `/kill` and one Phantom signature. Weekend: two posts.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md`

---

## 15:00 UTC · 12:00 BRT · Video · P1

```text
[VIDEO DAY 06]

/kill in Telegram pauses every agent at once. AgentGuard then drafts the transaction that removes each chain's onchain cap. You sign it in Phantom, and the money is shut off.
```

Caption for the video session: "The kill switch, start to finish."

---

## 19:00 UTC · 16:00 BRT · Visual: the kill, as run on mainnet · P1

Image: `assets/day-06/01-kill.png`

```text
The kill, as we ran it on Robinhood Chain mainnet:

1. /kill → Confirm: the agent paused
2. Phantom signed removeDelegate on the Safe Allowance Module
3. The page read back "no longer a delegate"

Rule we learned: always start a kill from /kill, not an old button.
```

Alt text: Diagram titled "/kill, then one Phantom signature." Step 1: /kill and Confirm in Telegram,
guard-core pauses every agent. Arrow: the bot drafts the owner transaction for each chain. Step 2: sign
in Phantom, on the signing page you deploy yourself. Arrow: Safe removeDelegate(hot, true), Squads
remove the spending limit. Step 3: read it back, "no longer a delegate", /status shows no limit.

Reply to self:

```text
Why "start from /kill": in a rehearsal, an older "Open kill in Phantom" button removed the onchain limit but left the agent unpaused until /kill → Confirm ran. The runbook now starts every kill from /kill.
```

---

## Reply bank for Day 6

**"How fast is the kill?"**

```text
The pause is immediate on /kill → Confirm. The onchain part takes as long as your Phantom signature and the chain. Timing the full kill on Solana mainnet is on our checklist before caps rise; we will post the number.
```

**"What if I lose my phone?"**

```text
The onchain part needs your owner wallet, wherever you run Phantom. The pause needs a listed Telegram owner. Rehearse your own kill once before you rely on it: self-host guide, step 7.
```

**"Does a kill reach payments already in flight?"**

```text
It does now. Our pre-release review found a pause did not reach a payment already waiting on the agent's lock. Fixed with a test: the policy is read under the lock.
```

**"Can I undo a kill?"**

```text
Yes: resume the agent in guard-core and re-enable the allowance or limit from your signing page, with a fresh Phantom signature. A kill is meant to be easy and the restart deliberate.
```
