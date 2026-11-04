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
| `pnpm status:base`      | Owners, threshold, the module, the Safe's USDC and the delegate's allowance, all read from the chain                                                                  |
| `pnpm kill:base`        | The owner removes the hot wallet as delegate, with its allowances, in one Safe transaction. Asks for `--yes`                                                          |

`enable-allowance` takes the module and USDC addresses from `shared/addresses.ts` when it has a
verified value for the chain, else from `BASE_ALLOWANCE_MODULE` and `BASE_USDC` in `.env`, and in
both cases refuses unless the chain holds code there and USDC reports 6 decimals. The owner key is
read from `.env` only; nothing secret goes on the command line, and the scripts print only
addresses and transaction hashes.

`createEvmAdapter({ chain, rpcUrl, hotWalletKey, safe, usdc, module })` is the `ChainAdapter`:

- `topUpHotWallet` calls `executeAllowanceTransfer` as the delegate itself (an empty signature), so
  the module's cap is the only limit and no relayer is paid.
- `simulate` runs one `eth_simulateV1` block: the two balances, the transfer, the two balances again,
  so before and after are read against the same state. Anything but exactly the amount moving is
  `SIM_UNEXPECTED_EFFECT`.
- `x402Scheme` gives the `@x402/evm` client a signer that can only sign typed data, and only an
  EIP-3009 `TransferWithAuthorization` for this USDC, chain, payer, recipient and amount, valid for
  at most an hour. Any other typed data, Permit and Permit2 included, is `PERMIT_DETECTED`. It has
  no transaction signer and no EIP-7702 authorization, so approval and delegation paths have
  nothing to sign with. What gets signed is rebuilt from the checked values, not passed through.
- `buildKillTx` is one Safe call, `removeDelegate(hot, true)`, unsigned, for an owner.

**Two differences from Solana that the owner should know:**

- The Allowance Module does not pin where a draw goes. `executeAllowanceTransfer` takes any `to`,
  so a stolen hot key could send the day's allowance straight to an attacker instead of through the
  hot wallet. On Solana the spending limit's destination list holds the hot wallet alone. The loss
  bound is the same on both chains (the daily cap plus the hot wallet balance), since the hot key
  can pay anyone with what it holds anyway; what Base loses is the extra step. The module has no
  recipient restriction to turn on, and the transaction guard of Safe 1.4.1, the version we deploy, does not see module transactions.
- On mainnet (`BASE_CHAIN_ID=8453`) the scripts refuse a raw `OWNER_PRIVATE_KEY`: the Safe owner
  must be a Ledger (`OWNER_SIGNER=ledger`), below.

### The Safe owner on a Ledger

`OWNER_SIGNER=ledger` makes `create-safe`, `enable-allowance` and `kill:base` sign as the account at
`OWNER_LEDGER_PATH` (default `44'/60'/0'/0/0`, Ledger Live's first Ethereum account) through the
official `@ledgerhq/hw-app-eth` client. The device signs only the Safe transaction's EIP-712 hash.
A separate `EXECUTOR_PRIVATE_KEY` pays the gas and submits it; it owns nothing, so the most it can
lose is its own ETH, and the owner confirms once per action.

The Ethereum app cannot show a Safe transaction's fields, only two hashes. Before asking the device,
the scripts print both, computed as the app computes them (app-ethereum,
`sign_message_eip712_common/common_712.c`), and refuse to sign if their hash differs from the one
protocol-kit will submit:

```
The Ledger will show Domain hash:  0x…
                   and Message hash: 0x…
(safeTxHash 0x…)
Approve only if both match the device exactly. On any difference, reject on the device.
```

Compare both on the device character for character; on any difference, reject and treat the
computer as compromised. As on Solana, the Safe must be created with the Ledger as owner from the
start. The tests drive the real `hw-app-eth` client against a fake device (`test/evm-ledger.ts`) and
check that its signature recovers to the device address and that the printed hashes are the ones it
received.

Safe's official list has no Allowance Module on Base Sepolia (CR-005). Check before running:
`cast code 0xAA46724893dedD72658219405185Fb0Fc91e091C --rpc-url https://sepolia.base.org`.

### Fork tests (EVM-6)

`forge/AllowanceCap.t.sol` proves the same four properties as the Solana cap tests, against the
official Allowance Module on a Base mainnet fork pinned to a fixed block. A Safe is created through
the official proxy factory, the owner enables the module, adds the hot wallet as delegate and sets a
100-unit daily allowance on a test token, and then:

1. the delegate draws up to the cap;
2. `cap + 1` reverts;
3. after a day the allowance refills;
4. after the kill, exactly the call `buildKillTx` builds (`removeDelegate(hot, true)`),
   `getTokenAllowance` returns 0 and a draw reverts.

The token is a test token on purpose: the cap is the module's, and this way no token address is
assumed. CI runs them in the `forge test (onchain)` job. On a machine with Foundry:

```bash
pnpm --filter @agentguard/onchain test:fork
```

`BASE_FORK_RPC_URL` overrides the public endpoint (`https://mainnet.base.org`); the fork block needs
an RPC that serves historical state, so a public endpoint that prunes will fail in `setUp`.
`BASE_FORK_BLOCK` overrides the pinned block. The module is not there yet at block 30,000,000, so the
pin is recent and has to move forward when the RPC stops serving its state.

`simulate()` needs `eth_simulateV1`, which not every provider serves. One command checks an endpoint,
with no key, printing only its answer:

```bash
BASE_RPC_URL=https://sepolia.base.org pnpm --filter @agentguard/onchain check:simulate
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
