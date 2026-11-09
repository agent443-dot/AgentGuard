# Security

AgentGuard sits between AI agents and money, so we treat security reports as the most important
issues we get.

## Reporting a vulnerability

Report it privately, through GitHub: **Security → Report a vulnerability** on this repository. Do
not open a public issue, pull request or discussion for it.

Include what you found, how to reproduce it, and what an attacker gains: funds moved, a policy
bypassed, a key or token exposed, the kill switch defeated. You will get an answer within 72 hours.
Please give us 90 days, or until a fix ships if that is sooner, before you publish.

There is no paid bug bounty yet. Reporters who want it are credited in the fix's release notes.

## Scope

In scope: everything in this repository.

- `guard-core`: the policy engine, simulation, signer and API.
- `mcp-server` and `telegram-bot`.
- The owner's signing page (`packages/onchain/web`).
- The onchain setup: Squads spending limits on Solana, the Safe Allowance Module on EVM chains.

Out of scope:

- The audited third-party contracts and programs themselves: Squads v4, Safe, the Allowance Module.
  Report those to their maintainers.
- An attacker who already has the owner's wallet or recovery phrase.
- Rate limits on public RPCs, and denial of service by volume.

## What the design promises

See [`SPEC.md`](./SPEC.md). In short:

- **Onchain**, even if guard-core has a bug: the most a day can cost is the daily cap plus what the
  hot wallet holds.
- **Offchain**, enforced by guard-core: every payment is checked against the agent's policy, then
  simulated, then auto-approved, sent to the owner on Telegram, or rejected.

A way to break either promise is exactly what we want to hear about.

Past reviews are in [`docs/security-review.md`](./docs/security-review.md).
