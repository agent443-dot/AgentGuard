# @agentguard/onchain

The `ChainAdapter` interface guard-core depends on, and its implementations. **No custom contracts:**
the onchain cap is a Squads v4 Spending Limit on Solana and the Safe Allowance Module on Base, both
audited and already deployed.

- **Owner:** Session 1 (onchain). This session edits only this package.
- **Tasks:** `SVM-*` and `EVM-*` in [`/coordination/BOARD.md`](../../coordination/BOARD.md).
- **Source of truth:** [`/SPEC.md`](../../SPEC.md).

## Solana

`createSvmAdapter({ chain, rpcUrl, hotWalletSecretKey, multisig, mint })` returns a `ChainAdapter`
built from plain values, so guard-core never handles a Solana SDK type.

| Method                | What it does                                                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getAllowanceState`   | Cap, spent and next reset, read from the spending limit account                                                                                                                                                      |
| `getHotWalletBalance` | The hot wallet's token account; zero when it has none                                                                                                                                                                |
| `topUpHotWallet`      | Draws on the spending limit into the hot wallet. The Squads program refuses anything past the cap                                                                                                                    |
| `simulate`            | Builds the exact message `send` would sign, runs `inspectTransfer`, then `simulateTransaction`. Both balances must move by exactly the amount, or `SIM_UNEXPECTED_EFFECT`                                            |
| `send`                | Rebuilds, re-inspects, signs and confirms a `TransferChecked` from the hot wallet                                                                                                                                    |
| `buildKillTx`         | The unsigned `removeSpendingLimit` instruction for the config authority, as JSON, with a description for the owner                                                                                                   |
| `checkPayment`        | The same inspection and simulation for an x402 transaction guard-core did not build                                                                                                                                  |
| `x402Scheme`          | A scheme client for `@x402/core` bound to one intent. The hot wallet signs only after the SDK's transaction passes the inspection and the simulation; otherwise it throws `SigningRefused` with the reasons (CR-003) |

### Tests

```bash
pnpm --filter @agentguard/onchain test
```

The adapter tests run against [LiteSVM](https://github.com/LiteSVM/litesvm) 1.x: the token,
associated token and memo programs execute for real, and only the RPC transport is faked
(`test/litesvm.ts`). LiteSVM 1.x speaks `@solana/kit`, so `test/svm.ts` converts at the boundary;
the 0.x releases, which spoke web3.js, abort with `std::bad_alloc` after a few program runs.

`test/cap.test.ts` proves the onchain cap with the real Squads v4 program, which gives every verdict:
a draw up to the cap succeeds, `cap + 1` is refused with `SpendingLimitExceeded`, the limit refills
after a warped day, and after the kill, signed by the owner through the fake Ledger, a draw is
refused because the limit account no longer exists. The program binary in `test/fixtures` was
dumped from mainnet:

```bash
solana program dump -u m SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf \
  packages/onchain/test/fixtures/squads_v4.so
```

### The owner on a Ledger

Every script the owner signs (`create-multisig`, `add-spending-limit`, `fund-vault`, `kill`) takes
`SOLANA_OWNER_KEYPAIR` as either a keypair file or a Ledger URI in the Solana CLI's form:
`usb://ledger` is `44'/501'`, `usb://ledger?key=0` is `44'/501'/0'`. The key never leaves the
device; the scripts send it the exact message and add the signature it returns, through the official
`@ledgerhq/hw-app-solana` client. The owner pays the fee, so each action is one confirmation.

Setup, once per device:

1. In Ledger Live, install the **Solana** app.
2. Leave **Blind signing** off (Solana app, Settings). The app cannot display Squads instructions,
   so each Squads action needs it on, but only for that action; the steps below say when. Plain SOL
   and token transfers show in clear without it.
3. Read the owner address: `solana-keygen pubkey usb://ledger?key=0`. It is the same address the
   scripts use.

**Blind signing removes the device's main protection.** While it is on, the device cannot show what
it signs, so a compromised computer could replace the kill with a transaction that hands the vault
over, and the device would still sign it. The one check left is the message hash. Before the device
is asked to sign, every script prints the hash the Solana app will show, computed the same way the
app does (base58 of the SHA-256 of the message, as in `src/handle_sign_message.c` of
`LedgerHQ/app-solana`):

```
If the Ledger shows a Message Hash, it must read exactly: 7Xk...
Approve only on an exact match. On any difference, reject on the device.
```

For each action:

1. Plug the Ledger in, unlock it and open the Solana app.
2. Turn **Blind signing** on (Settings in the Solana app).
3. Run the script. For the kill switch:
   ```bash
   SOLANA_OWNER_KEYPAIR='usb://ledger?key=0' pnpm kill --yes
   ```
4. Compare the **Message Hash** on the device with the printed one, character by character. Approve
   only if they match exactly; otherwise reject and treat the computer as compromised. Do this within
   a minute, before the blockhash expires.
5. Turn **Blind signing** off again. The script reminds you once the device has signed.

`kill` refuses before asking the device when the Ledger account is not the multisig's config
authority, which is the only key that can remove the limit.

A multisig created with a file key keeps that key as its config authority. On mainnet, create the
multisig with the Ledger from the start. If the authority ever has to move, the Squads SDK has
`multisigSetConfigAuthority`; no script here wraps it yet.

The tests drive the real `hw-app-solana` client against a fake device (`test/ledger.ts`) that speaks
the Solana app's APDUs, signs with real ed25519 keys and refuses unknown programs while blind
signing is off. It records the Message Hash it would display, and the tests check that it equals the
hash the script printed. `test/cap.test.ts` signs the kill with it.

## Base

A Safe holds the funds and the Safe Allowance Module caps the hot wallet per day. Neither is ours.

| Script                  | What it does                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm create-safe`      | Deploys a Safe with the owner EOA as its only owner, threshold 1. Refuses when `SAFE_ADDRESS` is already set, and reads owners and threshold back from the chain      |
| `pnpm enable-allowance` | One Safe transaction: enables the Allowance Module if it is not, adds the hot wallet as delegate, and sets a USDC allowance of `DAILY_CAP` that resets every 1440 min |

`enable-allowance` takes the module and USDC addresses from `shared/addresses.ts` when it has a
verified value for the chain, else from `BASE_ALLOWANCE_MODULE` and `BASE_USDC` in `.env`, and in
both cases refuses unless the chain holds code there and USDC reports 6 decimals. The owner key is
read from `.env` only; nothing secret goes on the command line, and the scripts print only
addresses and transaction hashes.

Safe's official list has no Allowance Module on Base Sepolia (CR-005). Check before running:
`cast code 0xAA46724893dedD72658219405185Fb0Fc91e091C --rpc-url https://sepolia.base.org`.

### Foundry fork tests (EVM-6, not written yet)

Fork Base Sepolia and prove the onchain guarantee:

1. the delegate can pull up to the cap within one period
2. pulling `cap + 1` reverts
3. after the reset period the allowance refills
4. after `kill`, the delegate cannot pull anything

```bash
forge test -vvv          # needs BASE_SEPOLIA_RPC_URL
```

## Addresses

Do **not** hardcode a guessed address. Read the Allowance Module address from the official Safe
deployment list and USDC from Circle's official list, then report both in
[`/CHANGES_REQUESTED.md`](../../CHANGES_REQUESTED.md) so the integrator can add them to
`packages/shared/src/addresses.ts`.

## Setup

```bash
cp .env.example .env     # then fill it in; never commit .env
pnpm --filter @agentguard/onchain test
```

Env vars are documented in [`.env.example`](./.env.example).
