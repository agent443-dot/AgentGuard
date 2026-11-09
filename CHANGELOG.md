# Changelog

## v0.1.0-beta — 2026-11-09

The first public beta. AgentGuard runs with real money on Robinhood Chain (USDG) and Solana (USDC)
mainnet. It is self-hosted: each user runs their own guard-core, Telegram bot and signing page, and
their vault is owned by their own Phantom wallet. It has had internal reviews but no external
audit yet. Hold in the vault only what you can afford to lose, and keep the daily cap small.

**Install:** "Install the beta" in the [README](./README.md#install-the-beta), or
[`docs/self-host.md`](./docs/self-host.md) by hand.

### What is in it

- **Onchain cap, no custom contract.** A Squads v4 spending limit on Solana and the Safe Allowance
  Module on Robinhood Chain. The guard's hot wallet can draw at most the daily cap.
- **Every payment checked.** guard-core holds the policy for each agent:
  - per-payment and daily limits;
  - token, chain, recipient and domain allowlists;
  - a simulation of the exact transfer;
  - your approval in Telegram above a threshold.
- **Pinned x402 payees.** A payment to a new recipient for a known site, or at more than twice the
  last price, is flagged and waits for you.
- **Circuit breaker.** An agent that makes too many payments in a minute is paused, and you are told.
- **Shadow mode.** New agents start in shadow mode: they run the whole check and pay nothing, so you
  see what they would have spent. `/mode <agent> live` turns one on.
- **Task budgets.** An agent can ask for one budget for a whole task: an amount, sites, a time
  limit. It never raises the policy.
- **Kill switch.** `/kill` in Telegram stops guard-core at once. One Phantom signature per chain
  then removes the onchain cap.
- **Proof of cap.** A read-only page shows anyone the most an agent can draw in the next 24 hours,
  read from the chain.
- **Owner commands in Telegram:** `/status`, `/budget`, `/report` with a weekly report, `/doctor`,
  `/agent`, `/policy`, `/allow`, `/deny`, `/mode`, `/kill`, `/resume`.
- **Setup wizard:** `create-agentguard`, with `--dry-run` and `doctor`. It also runs on any server
  with `docker-compose.yml`.
- **MCP tools for agents:** `paid_fetch`, `transfer`, `check_intent`, `get_budget`, `start_task`,
  and a `setup` command for Claude Code, Claude Desktop, Cursor and others.

### Built in, off until you configure them

- **Signed receipts:** an Ed25519 receipt for each payment, with `RECEIPT_SIGNING_KEY_FILE`.
- **Passkey approvals:** payments above `PASSKEY_ABOVE` can be approved only with your passkey, so a
  stolen Telegram account can reject but never approve them.

### Known limits

- No external audit yet. The internal reviews are in
  [`docs/security-review.md`](./docs/security-review.md), and the known risks in
  [`docs/final-report.md`](./docs/final-report.md).
- The owner key is in a software wallet (Phantom). The signing page is a trust root: deploy your own,
  from your own protected `main`.
- Phantom may call the Solana multisig creation "malicious" on a new domain. See
  [`docs/troubleshooting.md`](./docs/troubleshooting.md) for what to check before you confirm.
- The packages are not on npm yet. Run everything from a checkout of this repository.
- Base is next. It runs on Base Sepolia for development only.
