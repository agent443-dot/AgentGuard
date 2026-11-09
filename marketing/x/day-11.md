# Day 11 · Thursday 2026-11-19 · No custom contract

Theme: the onchain layer is Squads and Safe, nothing of ours.
Link: `https://github.com/agent443-dot/AgentGuard/tree/main`

---

## 13:30 UTC · 10:30 BRT · Video · P1

```text
[VIDEO DAY 11]

On Robinhood Chain, the daily cap is the Safe Allowance Module: the hot wallet is a delegate with an allowance that refills every 24 hours. The blockchain enforces it, not our code.
```

Caption for the video session: "How the Safe Allowance Module caps what the hot wallet can draw."

---

## 15:00 UTC · 12:00 BRT · Thread: why there is no custom contract · P1

**1/6** · Image: `assets/day-11/01-no-contract.png`

```text
AgentGuard moves money onchain, and we wrote zero smart contracts for it. That was a deliberate choice. 🧵
```

Alt text: Card titled "We wrote no contract. On purpose." Rows: Solana, Squads v4 multisig plus
Spending Limit. Robinhood Chain, Safe plus Safe Allowance Module 0.1.1. Base later, Safe plus Safe
Allowance Module 0.1.1. Footer: "Widely used, independently audited, already live. Our code decides
what to pay; theirs caps how much."

**2/6**

```text
The cap is the part that has to hold when everything else fails. So it should be code that is already audited, already live and widely used, not code we wrote last month.

Squads v4 on Solana. Safe and the Safe Allowance Module 0.1.1 on EVM.
```

**3/6**

```text
That splits the job in two:

• our code (guard-core) decides what to pay: policy, simulation, approval
• their code caps how much can be drawn in a day

The two layers do not trust each other.
```

**4/6**

```text
The trade-off: we take what those programs offer. The Allowance Module has no destination lock, so on Safe chains a stolen hot key can send the day's cap anywhere.

Same loss bound, wider path. Known risk #1.
```

**5/6**

```text
How we checked we are using the real thing:

• CI probes that the Squads v4 program on Solana mainnet is the binary the tests run
• every address in .env is checked against the chain: it must hold code, and the dollar must report 6 decimals
```

**6/6**

```text
The verified addresses live in packages/shared, and they win over anything in .env.

https://github.com/agent443-dot/AgentGuard/tree/main
```

---

## 20:00 UTC · 17:00 BRT · Visual tip · P5

Image: `assets/day-11/02-usdg.png`

```text
If you fund a Safe on Robinhood Chain, check the token address, not the name. Other tokens on that chain share it.

USDG: 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168

Our self-host guide makes you check it before you send.
```

Alt text: Card titled "Other tokens share the name. Check the address." Code block: "USDG on
Robinhood Chain (eip155:4663)" and the address 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168. Below:
"guard-core and the scripts also check every configured address against the chain: it must hold code,
and the dollar must report 6 decimals."

Before posting: compare the address character by character with `docs/self-host.md`, step 4.

---

## Reply bank for Day 11

**"Aren't you trusting Squads and Safe then?"**

```text
Yes, for the cap. That is a deliberate trust: they are audited and widely used. Bugs in their contracts are out of our scope and go to their maintainers. Bugs in how we use them are in scope.
```

**"Why not write a contract with a destination lock?"**

```text
A new contract is new code to audit and trust, holding the money. We preferred a wider path with a proven bound over a narrower path with unproven code. That can be revisited, in the open.
```

**"Which Allowance Module version?"**

```text
0.1.1, the official deployment. Base Sepolia's is listed because its code hash equals the official mainnet deployment's.
```
