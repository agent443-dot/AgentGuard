# CR-009 design note: AgentGuard token, governance and the staked x402 registry

Status: **draft for discussion**. CR-009 is proposed, not approved. Nothing here is deployed or
merged as code until the owner approves CR-009 and has settled the allocation, legal advice and the
governance parameters. The deployer is a new wallet, never the Phantom account that owns the vaults.

## The one rule that shapes everything

Nothing governed may have any authority over a user's funds. The Safe, the Allowance Module, the
Squads multisig and guard-core's caps stay owner-only, exactly as today. Governance can change
shared, opt-in things: the registry, a grants treasury, recommended defaults. A captured DAO can
then delist or mislist APIs, and spend its own treasury, but it cannot move a cent out of anyone's
vault. The rest of this note follows from that.

## (a) Contracts and versions

- **Source:** OpenZeppelin Contracts 5.x, pinned to its latest audited release when we implement.
  Every contract is used as published, with no edits to the library.
- **Compiler and toolchain:** Solidity 0.8.26 (the repo's pin) and Foundry. The EVM version must be
  one Robinhood Chain's ArbOS runs (PUSH0, MCOPY). The forge probe checks this on a 4663 fork
  before we choose it.
- **No upgrade paths:** no proxies and no owners. A fixed, immutable contract set is easier to
  audit and to trust.
- **Token** `ERC20 + ERC20Permit + ERC20Votes`:
  - The fixed supply is minted once in the constructor, and there is no `mint`.
  - There is no `Ownable`, pause or blacklist.
  - **Clock mode: `timestamp` (ERC-6372).** On Arbitrum Nitro chains, which Robinhood Chain is,
    `block.number` returns an approximation of the L1 block number. Block-based voting periods
    would then be wrong by an order of magnitude. Override `clock()` and `CLOCK_MODE()` to use
    timestamps, in the token and the Governor alike.
  - Distribution goes through OZ `VestingWallet`s and the treasury timelock at deploy time. The
    deployer keeps nothing, and the deploy script asserts this.
- **Governor** (OZ 5.x): `Governor`, `GovernorSettings`, `GovernorCountingSimple`, `GovernorVotes`,
  `GovernorVotesQuorumFraction`, `GovernorTimelockControl`, and `GovernorPreventLateQuorum` against
  last-minute swings.
- **`TimelockController`** holds the treasury and is the only admin of the registry's governed
  functions.
  - The proposer is the Governor (phase 2, below). The executor is `address(0)`: anyone can
    execute once the delay is over.
  - The canceller is a guardian Safe, during bootstrap only.
  - The admin role is renounced in the deploy script, and a post-deploy check asserts that no
    other role holder exists.

## (b) Governor + Timelock on 4663, or Snapshot first?

**Recommendation: two phases.**

1. **Bootstrap.**
   - Holders vote off-chain. Snapshot works if it supports chain 4663 (to check). Otherwise votes
     are EIP-712-signed and tallied from ERC20Votes checkpoints by a published script.
   - Execution goes through the same `TimelockController`. Its proposer is a guardian Safe whose
     signers are named, on new keys, and are not the vault-owner wallet.
   - The token and timelock are final from day one; only the proposer changes later.
2. **On-chain.** The Governor becomes the timelock's proposer once distribution makes quorum
   meaningful. The trigger is a stated number of holders and delegated supply, not a date. The
   guardian Safe keeps only the canceller role for a published sunset period, then renounces it.

**Why not the Governor from day one:**

- With a concentrated supply at launch, an on-chain vote is the owner's decision with extra steps.
  At low turnout, a small bloc can pass slashing or treasury proposals.
- Robinhood Chain has a centralized sequencer. A proposal's voting window must be long enough
  (≥ 5 days) for the L1 force-inclusion path (about 24h on Arbitrum) to rescue a censored vote. That
  makes early on-chain governance slow without making it safer.

**Starting parameters**, which are the owner's to fix:

- voting delay 2 days, voting period 5 days, timelock 3 days;
- quorum 4–10% of delegated supply;
- a proposal threshold high enough to stop spam.

## (c) The staked x402 registry

**Entry** `keccak256(normalizedDomain) → { provider, payTo[chainId], stake, status, listedAt }`:

- The normalized domain is lowercase ASCII, with IDNs in punycode, and without a trailing dot or
  port.
- `payTo` is the recipient per CAIP-2 chain. It is what makes an entry useful: the guard can check
  an x402 requirement's `payTo` against the registered one. A domain whose server is compromised
  can't then redirect payments without also controlling the provider key.

**Stake in USDG, not the governance token.** A bond in a stable asset has a predictable cost to the
lister and a predictable value to slash. A bond in the token makes the bond's value follow the token
price. It also gives token holders an incentive to slash for profit. The governance token can still
earn holder benefits, such as a lower listing fee or a share of the slashed funds, without being the
bond.

**Flows:**

- **List.**
  - `list(domain, payTo[], stake ≥ minStake)` puts the entry in `Pending` for a challenge window,
    say 7 days. Ownership of a domain can't be proven on-chain.
  - The provider publishes `https://<domain>/.well-known/agentguard.json` with the provider
    address and the payTo addresses. Anyone can check it during the window.
- **Report.** `report(entry, reasonCode, evidenceURI)` posts a reporter bond: a fixed fraction of
  the minimum stake. The bond deters spam reports.
- **Resolve.** Only the timelock resolves a report: `slash(entry, amount ≤ maxSlashPerAction)` or
  `dismiss(report)`.
  - A slash pays the reporter's bond back plus a share, and the rest goes to the grants treasury.
  - A dismissal forfeits the reporter's bond to the provider.
  - The cap on each slash limits what a single captured vote can do.
- **Exit.**
  - `requestExit` starts an unbonding delay longer than the challenge window plus the governance
    path, so a provider can't exit ahead of a pending slash.
  - An open report freezes the exit.
  - `withdraw` pays out after the delay.
- **Delist.** The timelock can delist with or without a slash, for example for a domain sold to
  someone else.

**How a guard reads it.** Guards should **not** read the chain once per payment: that adds RPC
latency and liveness risk, and it means trusting one RPC on the payment path.

- guard-core runs a sync job, for example hourly. It reads all `Active` entries through view calls
  and events from the owner's configured Robinhood RPC, and optionally cross-checks a second RPC.
  The sync job and the guard-core change it needs are guard-core's to build.
- It keeps the result as a cached allowlist with a timestamp.
- **Fail closed:** if the last good sync is older than a set limit, the registry counts as empty.
  The guard falls back to the owner's own allowlist, and payments to registry-only domains are
  refused, not allowed.
- Not a signed list: that adds a trusted signer the design is meant to avoid. If the list grows
  large, the registry can publish a Merkle root on-chain. The guard then fetches the list from
  anywhere and checks it against the root.

**What the registry may change in a guard, and what it may not.** The registry is an opt-in
allowlist source only, for example "domains in the registry with stake ≥ X". It never relaxes a
per-transaction or daily cap, an approval threshold, or the owner's blocklist. The `payTo` match is
an extra refusal reason: a registry domain whose x402 `payTo` differs from its entry is refused.

## (d) Attack surface

| Attack                                                         | What it gets                                                                                                               | Mitigation                                                                                                                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governance capture: concentrated supply, bribery, vote markets | Registry delist/slash, the grants treasury, recommended defaults. **No user funds** (the rule above).                      | Limited scope; timelock delay; guardian canceller during bootstrap; a cap on each slash; quorum; two phases.                                             |
| Flash-loan votes                                               | Nothing. ERC20Votes reads the checkpoint at the proposal snapshot (`votingDelay > 0`), and a flash loan can't span blocks. | Keep `votingDelay ≥ 1 day`. Tokens borrowed over the delay (lending markets) are the residual risk, so watch money markets that list the token.          |
| Registry spam and squatting                                    | A guard trusts a domain the lister doesn't own.                                                                            | Minimum stake and listing fee; challenge window; `.well-known` proof; reporter bonds; the payTo match; guards opt in by stake threshold.                 |
| Report griefing                                                | Providers' exits get frozen.                                                                                               | Reporter bond, forfeited on dismissal; deadlines for resolving reports.                                                                                  |
| Captured slashing                                              | An honest provider's stake is burned.                                                                                      | A cap on each slash; timelock delay, so the provider sees it coming; an appeal by a counter-proposal during the delay.                                   |
| Sequencer censorship (single sequencer)                        | Votes or reports blocked.                                                                                                  | Windows longer than L1 force inclusion; parameters chosen with it in mind.                                                                               |
| Permit phishing (EIP-2612)                                     | A holder signs away an allowance.                                                                                          | A wallet-side risk; warn in the docs. The guard never asks for permits for the governance token.                                                         |
| Deployer or role leftovers                                     | Hidden admin power.                                                                                                        | No owners or proxies; the admin role is renounced; a post-deploy script asserts no role holders beyond the intended ones; source verified on Blockscout. |
| Legal: the token as a security, holder-benefit rules           | Not technical                                                                                                              | The owner's legal advice comes first (CR-009 precondition).                                                                                              |

## (e) Test and audit plan

1. **Foundry unit and fuzz tests:** every function and revert path of the registry.
2. **Invariant tests:**
   - the token's total supply never changes;
   - the sum of stakes equals the registry's USDG balance minus pending fees;
   - a slash never exceeds the stake;
   - no exit completes while a report is open;
   - delegated votes equal checkpointed balances.
3. **4663 fork tests:**
   - the clock mode and the opcodes the chosen EVM version uses;
   - the full Governor lifecycle with `vm.warp`: propose, vote, queue, execute, and cancel by the
     guardian;
   - a registry list → report → slash → exit flow with the real USDG.
4. **Static analysis in CI:** Slither and Aderyn, failing on high findings.
5. **Coverage:** 100% branches on the registry. The token and Governor are stock OZ, so their tests
   cover the composition and the parameters.
6. **Testnet:** a 46630 deployment run by the deploy script itself, with a public test period and
   a bug bounty before mainnet.
7. **External audit of the registry**, the only custom contract, and a review of how the token,
   Governor and Timelock are composed and configured. Any finding is fixed and re-audited before
   mainnet.
8. **Mainnet deploy:**
   - deterministic (CREATE2) from the new wallet, with the constructor args reviewed in a PR;
   - verified source on Blockscout;
   - post-deploy assertions run as a forge script against 4663 (roles, supply, distribution
     balances);
   - a recorded runbook.

## Open questions for the owner

- The allocation: the team, the treasury, grants, any sale or airdrop, and the vesting schedules.
- The governance parameters above, and the criteria for moving to phase 2.
- Whether staking should also exist on Solana (a second registry) or stay on 4663 only. The
  Solana guards would then read 4663, which a guard-core sync job can do.
- Legal advice on the token and on holder benefits.
