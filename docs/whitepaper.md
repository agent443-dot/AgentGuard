# AgentGuard: a payment firewall for AI agents

**Technical whitepaper · v0.1.0-beta · 9 November 2026**

> AgentGuard is in public beta. It runs with real money on Robinhood Chain and Solana mainnet. It has
> had internal security reviews but no external audit yet. This paper describes the system as built;
> [`SPEC.md`](../SPEC.md) is the source of truth for every interface.

## Abstract

AI agents now pay for things: per-call APIs over x402, data, compute, other agents. The simple way
to let an agent pay is to give it a wallet key. Then a prompt injection, a bug or a runaway loop can
spend everything the key controls, and nothing stands between the model's output and the money.

AgentGuard puts a layer between the two. The agent never holds a key. It asks to pay through the
Model Context Protocol (MCP). guard-core checks each request against the owner's policy, simulates
the exact transfer, and asks the owner on Telegram when the amount is above a threshold or something
looks wrong. Only then does it sign, with a hot wallet that the chain itself limits to a daily cap
drawn from the owner's vault. The cap uses audited onchain components, the Squads v4 spending limit
on Solana and the Safe Allowance Module on EVM chains, so there is no custom contract to trust.

The result is a bound that holds even if the offchain software fails: **the most a day can cost is
the daily cap plus whatever sits in the hot wallet.** Everything above that bound is a further check
that makes a bad payment less likely, not a promise that it is impossible.

## 1. The problem

An agent that can pay meets four risks that a human with a card does not:

1. **Instructions arrive with data.** A web page, an API response or a document the agent reads can
   tell it to pay someone. The model may comply.
2. **Loops are fast.** An agent can make hundreds of paid calls a minute. A bug that would cost a
   person one charge costs an agent a hundred.
3. **The payee can change under you.** An x402 API names its own recipient and price in each 402
   response. A compromised or malicious API can raise the price or swap the recipient.
4. **Keys cannot be half-given.** A private key either signs or it does not. Whatever the agent can
   reach, a successful attack can reach too.

Wallet-level spending limits help with the last point, but alone they see neither the agent, nor the
API, nor the reason for a payment. Policy checks in software see all of that, but they fail when the
software fails. AgentGuard uses both, in layers.

## 2. Design principles

- **The agent never holds a key.** It can only ask. Agent text (reasons, URLs, headers, API
  responses) is untrusted input and never changes a policy.
- **A loss bound enforced onchain.** The worst day is set by the chain, not by our code.
- **No custom contract.** The cap uses Squads v4 and the Safe Allowance Module, both audited and in
  wide use. AgentGuard deploys no contract of its own.
- **Deny by default, fail closed.** A new agent may pay nothing. Any doubt while parsing a payment
  request means no.
- **Self-hosted.** Each owner runs their own guard, bot and signing page, and owns their vault with
  their own wallet. There is no hosted service and nothing in the path belongs to us.
- **Money is bigint.** Every amount is an integer in the token's base units. No floating point
  touches money.
- **Everything is audited.** Every decision is written to an audit log with its reasons.

## 3. Architecture

```
Owner vault: a Squads multisig (Solana) or a Safe (EVM), owned by the owner's Phantom wallet
  └─ onchain daily cap: delegate = guard hot wallet, token = the chain's dollar, 24-hour period
       └─ guard hot wallet: a small balance; its key is held only by guard-core
            └─ pays x402 APIs and transfers, after policy, simulation and, when needed, the owner
```

| Component        | Role                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vault**        | Holds the funds. Only the owner's wallet controls it. Squads v4 on Solana, Safe 1.4.1 on EVM.                                                     |
| **Onchain cap**  | Lets the hot wallet draw at most the daily cap from the vault. On Solana the hot wallet is the limit's only member and only destination.          |
| **guard-core**   | The policy engine, the simulation, the signer and the x402 client, with an HTTP API and a SQLite database. The only holder of the hot wallet key. |
| **mcp-server**   | Exposes payment tools to any MCP client: Claude Code, Claude Desktop, Cursor and others. Holds an agent token, never a key.                       |
| **Telegram bot** | The owner's console: approvals, alerts, reports, the doctor, agent and policy commands, and the kill switch. Answers only listed owners.          |
| **Signing page** | A static page the owner deploys. Phantom signs the vault's setup and its kill there, and the page reads each result back from the chain.          |

Supported chains at v0.1.0-beta:

| Chain           | Dollar | Vault and cap                            | Status                   |
| --------------- | ------ | ---------------------------------------- | ------------------------ |
| Robinhood Chain | USDG   | Safe with the Allowance Module 0.1.1     | Live on mainnet          |
| Solana          | USDC   | Squads v4 multisig with a spending limit | Live on mainnet          |
| Base            | USDC   | Safe with the Allowance Module 0.1.1     | Next; Base Sepolia today |

## 4. The life of a payment

An agent pays in one of two ways: `paid_fetch`, which calls an API and settles its x402 402
response, or `transfer`, a direct payment to an address. Each becomes a **payment intent**, which
guard-core takes through these steps in order and stops at the first refusal:

1. **Authenticate.** The agent's token is checked against stored hashes. An agent acts only as itself.
2. **Parse.** For x402, guard-core parses the 402 response itself. A malformed or ambiguous one is
   refused as `INVALID_402`.
3. **Policy.** The intent must fit every rule of the agent's policy (section 5).
4. **Task budget.** If the intent names a mandate, it must also fit that mandate's remaining budget,
   sites, recipients and expiry.
5. **Circuit breaker.** A payment that would exceed the agent's payments-per-minute limit is refused,
   and the agent is paused.
6. **Pinning.** For x402, guard-core compares the request with the last payment it made to that site.
   A different recipient, chain or token, or a price above the pinned one by more than the policy
   allows (by default, more than double), sends the payment to the owner even below the threshold.
7. **Simulation.** guard-core builds the exact transaction and simulates it on the chain. The
   transaction must move only the expected amount of the expected token to the expected recipient.
   On EVM chains, signing is limited to `TransferWithAuthorization` with every field checked, and
   token approvals, permits and EIP-7702 delegations are refused. On Solana, guard-core inspects
   every instruction and refuses new delegates, authority changes, account closes, calls into
   programs that are not on the allowlist, and address lookup tables that hide accounts.
8. **Approval.** At or above the approval threshold, or with a pinning flag, the owner decides on
   Telegram before a deadline. An approval expires and can be redeemed once. Above an optional
   passkey threshold, Telegram can only reject; approving needs the owner's passkey.
9. **Sign and execute.** guard-core draws what the payment needs from the vault through the onchain
   cap, signs and submits. The intent ends as `executed` or `failed`.
10. **Record.** The decision and its reasons go to the audit log. When configured, a signed receipt
    is issued for the payment.

An intent's status is one of `pending_approval`, `approved`, `rejected`, `executed`, `failed`,
`expired` or, in shadow mode, `shadowed`.

## 5. The policy

Each agent has its own policy, and a new agent's policy denies everything:

| Field                                 | Meaning                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `chains`, `tokens`                    | Where and in what the agent may pay.                                    |
| `perTxMax`, `dailyMax`                | The most per payment and per day, in base units.                        |
| `approvalThreshold`                   | At or above this amount, the owner approves on Telegram.                |
| `allowedRecipients`, `allowedDomains` | Who the agent may pay directly, and which x402 sites. Empty means none. |
| `paused`                              | Stops every payment from this agent.                                    |
| `mode`                                | `live`, or `shadow`: evaluate and simulate everything, sign nothing.    |
| `priceIncreaseMaxPct`                 | How far above its pinned price an x402 site may go without the owner.   |
| `maxPaymentsPerMinute`                | The circuit breaker's limit.                                            |
| `requireMandate`                      | When true, every payment must belong to an open task budget.            |

A refusal always names its reasons. There are 24 reject codes: 16 shared by every chain (such as
`DOMAIN_NOT_ALLOWED`, `DAILY_EXCEEDED`, `SIM_UNEXPECTED_EFFECT` and `BREAKER_TRIPPED`), 3 specific
to EVM chains and 5 specific to Solana. The agent receives each code with a plain explanation and is
told not to retry a refused payment.

## 6. The onchain cap and the loss bound

The cap is the layer that does not depend on AgentGuard's own code.

- **Solana.** A Squads v4 spending limit on the owner's multisig: the USDC mint, a daily period, the
  hot wallet as the limit's only member **and only destination**. A stolen hot key can move at most
  the day's cap, and only into the hot wallet itself.
- **EVM (Robinhood Chain, Base).** The Safe Allowance Module 0.1.1, with the hot wallet as the only
  delegate and an allowance in the chain's dollar that resets every 24 hours. The module lets a
  delegate send to any address, so a stolen hot key can send the day's cap anywhere.

In both cases the bound is the same: **the daily cap plus the hot wallet's balance**. The hot wallet
holds little or nothing, since guard-core draws from the vault only when it pays. The signing page
refuses a cap above 50 of the chain's dollar, and the default is 20.

Anyone can check the cap. The signing page's proof view reads the vault from the chain and shows the
most the agent can draw in the next 24 hours. It says "Verified" only when the vault's owners,
modules, delegates and limits match the expected setup exactly, and it never shows a lower number
when a read fails.

## 7. Layers beyond the cap

The cap bounds the worst day. These layers make a bad payment inside that bound less likely:

- **Recipient and price pinning** (section 4, step 6) catches a compromised x402 API that swaps its
  recipient or inflates its price.
- **Circuit breaker.** Ten payments a minute by default. The next one pauses the agent and alerts the
  owner.
- **Shadow mode.** New agents start in shadow mode. They run every check and simulation and sign
  nothing, and the owner sees what they would have spent before switching them live.
- **Task budgets (mandates).** An agent asks for one budget per task: an amount, the sites and
  recipients it needs, and a lifetime of one minute to one day. A budget only narrows the policy,
  never widens it, and above the threshold the owner approves it like a payment.
- **Passkey approvals.** Above an amount the owner sets, a Telegram tap can only reject. Approval
  needs a WebAuthn passkey with user verification, on a page guard-core serves. The first passkey is
  enrolled with a one-time code; every later one needs an assertion from an enrolled passkey, and
  every enrolment alerts the owner. A stolen Telegram account can stop a payment but never send one.
- **Signed receipts.** Each executed payment can carry an Ed25519 receipt over the intent, the hash
  of the policy in force, the simulation and who approved it, verifiable with a public key.
- **Paid content is data.** What `paid_fetch` returns is marked to the model as data, not
  instructions.

## 8. The owner's controls

- **Telegram.** Approvals with the chain, amount, recipient and explorer links in every message;
  `/status`, `/budget`, `/report` and a weekly report; `/doctor`, which checks the database, each
  chain's cap, each hot wallet's gas and balance, the bot and backups; `/agent`, `/policy`, `/allow`,
  `/deny` and `/mode` to run agents without a terminal.
- **The kill switch.** `/kill` pauses guard-core at once, including payments already queued. One
  Phantom signature per chain then removes the onchain cap. Kill links expire after 15 minutes, so an
  old button cannot fire later.
- **The signing page.** Phantom cannot run scripts, so the owner signs vault changes on a static page
  they deploy themselves. The hot wallet addresses are built into the page and a link cannot change
  them. The page has a strict Content-Security-Policy, loads no third-party script, and builds only
  from the owner's protected `main`.

## 9. Integration

Agents connect through MCP. The server exposes five tools: `paid_fetch`, `transfer`, `check_intent`,
`get_budget` and `start_task`. A `setup` command prints the exact configuration for Claude Code,
Claude Desktop, Cursor or any other client and stores the agent token in a file with owner-only
permissions, never on the command line. Every amount the agent sees is in dollars, and every refusal
arrives with its reason.

A setup wizard, `create-agentguard`, takes an owner from nothing to a running deployment: it
generates the keys locally, creates the Fly.io apps, deploys the signing page, prints each Phantom
link, reads the result back from the chain, and creates the first agent in shadow mode. The same
images run on any server with Docker Compose.

## 10. Threat model

| Threat                                 | What stops it                                                                                  | What is left                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Prompt injection asks the agent to pay | Policy allowlists, limits, the simulation, owner approval above the threshold                  | A payment that fits the policy and is below the threshold goes through                      |
| Runaway loop                           | Circuit breaker, daily limit, onchain cap                                                      | Up to the breaker's limit before the pause                                                  |
| Malicious or compromised x402 API      | Domain allowlist, recipient and price pinning, simulation of the exact transfer                | A first payment to a newly allowed site has no pin yet                                      |
| Stolen agent token                     | It can only ask; the same checks apply; tokens are revocable                                   | The attacker can spend what that agent's policy allows                                      |
| Stolen hot wallet key                  | The onchain cap                                                                                | Up to the day's cap; on EVM chains to any address, on Solana only into the hot wallet       |
| guard-core compromised                 | The onchain cap                                                                                | Up to the day's cap plus the hot wallet's balance                                           |
| Stolen Telegram account                | Owner allowlist; with passkeys on, it can reject but not approve above the passkey threshold   | Below that threshold, it can approve                                                        |
| Malicious signing-page deploy          | Each owner deploys their own page from their own protected `main`; the page reads results back | Whoever can redeploy the page can show a harmless summary of a harmful transaction          |
| Owner wallet compromised               | Nothing in AgentGuard: this key controls the vault                                             | The whole vault, which is why the vault holds only what the agents need for the coming days |

Further known limits are listed in [`docs/final-report.md`](./final-report.md): rate limits count
per socket address, guard-core is a single process with SQLite, and one high-severity advisory sits
in the lockfile without being reachable at runtime.

## 11. Verification

- **1,294 automated tests** across the packages: guard-core 466, mcp-server 254, telegram-bot 233,
  onchain 221, the setup wizard 67 and end-to-end 53.
- **39 attack scenarios** in the end-to-end suite: 24 on Solana and 15 on EVM chains.
- **Real programs, not mocks, where it matters.** The Solana tests run the real Squads v4 program in
  LiteSVM: the cap, the cap plus one, the daily refill and a kill. The Safe tests run the official
  Allowance Module on forks of Base and Robinhood Chain mainnet. The signing page is tested in a real
  Chromium.
- **Continuous integration** runs lint, type checks, every test, the Foundry tests, the signing page
  tests, a check that no secret can reach a Docker image, and probes that the Squads program on
  mainnet is the binary the tests run.
- **Live runs.** Payments over x402 were made on Solana devnet and Base Sepolia, and with real money
  on Robinhood Chain mainnet. On mainnet the owner signed the vault setup, the cap and a full kill
  rehearsal in Phantom on both chains.
- **Reviews.** Every package had internal security reviews before release, and every finding was
  fixed with a test. They are recorded in [`docs/security-review.md`](./security-review.md).
  **There has been no external audit yet.**

## 12. Roadmap

- **Base mainnet**, after its addresses are confirmed live and it has its own pilot, as Robinhood
  Chain had.
- **An external security audit.**
- **Hot keys in a KMS** before caps rise above the starting level.
- **Off-site database backups**, beyond the daily volume snapshots.
- **Publishing the packages on npm**, so the wizard and the MCP setup run with one command.
- **Higher caps** only after two to three weeks on mainnet with no unexplained intent in the audit
  log.

## References

- [`SPEC.md`](../SPEC.md): every interface, type and reject code.
- [`docs/self-host.md`](./self-host.md): running your own copy.
- [`docs/adr/`](./adr): architecture decisions, including the Phantom signing page (ADR 003).
- [`docs/security-review.md`](./security-review.md) and [`docs/final-report.md`](./final-report.md).
- [`SECURITY.md`](../SECURITY.md): how to report a vulnerability privately.

AgentGuard is open source under the Apache-2.0 licence:
[github.com/agent443-dot/AgentGuard](https://github.com/agent443-dot/AgentGuard).
