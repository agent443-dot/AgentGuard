# @agentguard/onchain

The `ChainAdapter` interface guard-core depends on, and its implementations. **No custom contracts:**
the onchain cap is a Squads v4 Spending Limit on Solana and the Safe Allowance Module on Base, both
audited and already deployed.

- **Owner:** Session 1 (onchain). This session edits only this package.
- **Tasks:** `SVM-*` and `EVM-*` in [`/coordination/BOARD.md`](../../coordination/BOARD.md).
- **Source of truth:** [`/SPEC.md`](../../SPEC.md).

## Setting up, end to end

The money flow is the same on both chains. The owner's funds sit in a multisig the owner alone
controls. A daily cap lets the guard's hot wallet draw up to `DAILY_CAP` a day from it, and nothing
else. The kill switch removes that cap, which cuts the hot wallet off. Most a day can cost is
`DAILY_CAP` plus what the hot wallet holds.

Every command below runs from `packages/onchain`, reads its settings from `.env` and prints only
public data: addresses, amounts, transaction ids. No key is ever passed on the command line.

```bash
pnpm install                 # from the repository root
cd packages/onchain
cp .env.example .env         # never commit .env
```

Set `DAILY_CAP` in atomic units (USDC has 6 decimals, so `100000000` is 100 USDC). Do the devnet or
testnet run first; the mainnet steps are the same with the changes listed at the end of each chain.

### Solana

You need the [Solana CLI](https://solana.com/docs/intro/installation), SOL for fees on the owner
account, and USDC to fund the vault.

1. **Keys.** Create the owner key and the hot wallet key, outside the repository:
   ```bash
   solana-keygen new -o ~/.agentguard/sol-owner.json
   solana-keygen new -o ~/.agentguard/sol-hot.json
   ```
   The hot wallet key goes to guard-core only. Here, set `SOLANA_OWNER_KEYPAIR` to the owner file
   and `SOLANA_HOT_WALLET_PUBKEY` to `solana-keygen pubkey ~/.agentguard/sol-hot.json`.
2. **Network.** `SOLANA_CLUSTER` and `SOLANA_RPC_URL` (devnet: `https://api.devnet.solana.com`).
   `USDC_MINT` comes from Circle's list of USDC addresses (never from memory; the values we verified
   are in `packages/shared/src/addresses.ts`).
3. **Fees.** On devnet, `solana airdrop 1 <owner address> -u devnet`.
4. **The multisig.** `pnpm create-multisig` creates a Squads multisig with the owner as its only
   member and config authority. Copy the printed `SQUADS_MULTISIG` into `.env` (and into
   guard-core's). It refuses to run when `SQUADS_MULTISIG` is already set.
5. **The cap.** `pnpm add-spending-limit` adds a spending limit of `DAILY_CAP` per day on USDC, with
   the hot wallet as its only member and its only destination, and prints it as read back from the
   chain.
6. **Funds.** `pnpm fund-vault <atomic units>` moves USDC from the owner to the vault. The vault and
   the multisig are different addresses; the cap draws from the vault, so fund that one.
7. **Check.** `pnpm status` reads the whole setup back from the chain; `pnpm balances` shows each
   account. To see the cap work, `SOLANA_HOT_WALLET_KEYPAIR=~/.agentguard/sol-hot.json pnpm top-up
<amount>` draws on it as guard-core would, and a draw past the cap is refused by Squads.
8. **Kill switch.** `pnpm kill` shows what it would remove; `pnpm kill --yes` removes the limit.
   Only `add-spending-limit` undoes it.

**For mainnet:** `SOLANA_CLUSTER=mainnet-beta`, a mainnet RPC, the mainnet USDC mint, and the owner
on a Ledger (`SOLANA_OWNER_KEYPAIR=usb://ledger?key=0`) from step 4 on, so that the Ledger is the
config authority. Read [The owner on a Ledger](#the-owner-on-a-ledger) before the first action.

### Base

You need Base Sepolia ETH for gas on the owner account (or the executor's, with a Ledger) and USDC
to fund the Safe.

1. **Check the chain has what the scripts need.** The Allowance Module must hold code at its
   address, and guard-core's simulation needs an RPC that serves `eth_simulateV1`. One command
   checks both, with no key:
   ```bash
   BASE_RPC_URL=https://sepolia.base.org pnpm check:simulate
   ```
   It must print `eth_simulateV1 supported` and `Allowance Module 0xAA46…091C: deployed`. CI runs it
   against Base Sepolia in the `eth_simulateV1 on Base Sepolia` job.
2. **Settings.** `BASE_CHAIN_ID=84532`, `BASE_RPC_URL`, the owner (`OWNER_SIGNER=key` with
   `OWNER_PRIVATE_KEY` on testnets), `HOT_WALLET_ADDRESS` (the guard's hot wallet; its key goes to
   guard-core only). On Base Sepolia `shared/addresses.ts` has both USDC and the Allowance
   Module, so leave `BASE_USDC` and `BASE_ALLOWANCE_MODULE` empty. On Base mainnet, USDC still comes
   from `.env`, read from Circle's list, until shared has it. The scripts refuse an address with no
   code, and a token that does not report 6 decimals.
3. **The Safe.** `pnpm create-safe` deploys a Safe 1.4.1 with the owner as its only owner,
   threshold 1. Copy the printed `SAFE_ADDRESS` into `.env` (and guard-core's). It refuses to run
   when `SAFE_ADDRESS` is already set.
4. **The cap.** `pnpm enable-allowance` sends one Safe transaction that enables the Allowance
   Module, adds the hot wallet as delegate and sets a USDC allowance of `DAILY_CAP` resetting every
   1440 minutes, then prints it as read back.
5. **Funds.** Send USDC to `SAFE_ADDRESS` from any wallet. There is no script for it.
6. **Check.** `pnpm status:base` reads owners, threshold, the module, the Safe's USDC and the
   allowance from the chain.
7. **Kill switch.** `pnpm kill:base` shows the allowance; `pnpm kill:base --yes` removes the hot
   wallet as delegate together with its allowances. Only `enable-allowance` undoes it.

**For mainnet:** `BASE_CHAIN_ID=8453`, a mainnet RPC and mainnet USDC. The scripts refuse mainnet
unless the owner is a Ledger: `OWNER_SIGNER=ledger`, `OWNER_LEDGER_PATH`, and an
`EXECUTOR_PRIVATE_KEY` that pays the gas. Read
[The Safe owner on a Ledger](#the-safe-owner-on-a-ledger) first, and create the Safe with the
Ledger as owner from the start.

## Reference

### Solana adapter

`createSvmAdapter({ chain, rpcUrl, hotWalletSecretKey, multisig, mint })` returns a `ChainAdapter`
built from plain values, so guard-core never handles a Solana SDK type.

| Method                | What it does                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getAllowanceState`   | Cap, spent and next reset, read from the spending limit account                                                                                                                                                                                                                                                                                                                              |
| `getHotWalletBalance` | The hot wallet's token account; zero when it has none                                                                                                                                                                                                                                                                                                                                        |
| `topUpHotWallet`      | Draws on the spending limit into the hot wallet, creating its token account first if it has none. The Squads program refuses anything past the cap                                                                                                                                                                                                                                           |
| `simulate`            | Builds the exact message `send` would sign, runs `inspectTransfer`, then `simulateTransaction`. A hot wallet short of the amount gets the spending-limit draw for the shortfall in front of the payment, in the simulation only, and the vault must fall by exactly that. Both payment balances must move by exactly the amount, or `SIM_UNEXPECTED_EFFECT`. A `SIM_FAILED` summary says why |
| `send`                | Rebuilds, re-inspects, signs and confirms a `TransferChecked` from the hot wallet                                                                                                                                                                                                                                                                                                            |
| `buildKillTx`         | The unsigned `removeSpendingLimit` instruction for the config authority, as JSON, with a description for the owner                                                                                                                                                                                                                                                                           |
| `checkPayment`        | The same inspection and simulation for an x402 transaction guard-core did not build                                                                                                                                                                                                                                                                                                          |
| `x402Scheme`          | A scheme client for `@x402/core` bound to one intent. The hot wallet signs only after the SDK's transaction passes the inspection and the simulation; otherwise it throws `SigningRefused` with the reasons (CR-003)                                                                                                                                                                         |

#### Tests

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

#### The owner on a Ledger

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

#### The owner in Phantom: the signing page

The scripts cannot sign with Phantom, so the owner signs through a static page in `web/`. The
design is in [ADR 003](../../docs/adr/003-phantom-owner.md).

- **The link carries the action and public addresses only.** Each action builds its instruction
  with the same builder as the script it replaces:

  | Link                                                                      | Instruction                   | Builder                          |
  | ------------------------------------------------------------------------- | ----------------------------- | -------------------------------- |
  | `/?action=create&cluster=<cluster>`                                       | `multisigCreateV2`            | `createMultisigInstruction`      |
  | `/?action=add-limit&cluster=<cluster>&multisig=<pda>&amount=<base units>` | `multisigAddSpendingLimit`    | `addSpendingLimitInstruction`    |
  | `/?action=kill&cluster=<cluster>&multisig=<pda>&hot=<pubkey>`             | `multisigRemoveSpendingLimit` | `removeSpendingLimitInstruction` |

  The limit's address is derived from the hot wallet, so the page adds and removes the limit the
  adapter draws on and nothing else. The USDC mint comes from `shared/addresses.ts` at build time,
  never from the link. So does the hot wallet that add-limit grants: a link naming any other key is
  refused, since a crafted one could otherwise let an attacker's key draw the full cap. Rotating the
  hot wallet is a redeploy from `main`. The amount must not exceed `MAX_DAILY_CAP`. Create makes its one-time create key in the browser; the key signs before
  Phantom does.

- **It checks the chain before asking Phantom.** The multisig must belong to the Squads program and
  have the connected wallet as its config authority. Add-limit refuses when a limit already exists:
  changing the cap means a kill, then a new limit. A kill still removes a limit with unexpected
  members or destinations, with a warning shown.
- **It shows the summary, then asks Phantom right away.** It uses `signAndSendTransaction`, then
  reads the chain until the change is there, and checks it is what was signed.
- **In a browser without Phantom,** it links to `https://phantom.app/ul/browse/<page>`, which opens it
  inside Phantom.
- **The build fixes what a link must not choose:**
  - the RPC endpoints, where `SOLANA_MAINNET_RPC` and `SOLANA_DEVNET_RPC` override the public
    defaults;
  - the hot wallet per cluster, `SOLANA_HOT_WALLET_MAINNET` and `SOLANA_HOT_WALLET_DEVNET`;
    add-limit refuses on a cluster with none;
  - `MAX_DAILY_CAP`, in base units, 50 USDC unless set (D1).

  The CSP allows scripts and styles from the page's own origin and connections to those endpoints
  only.

```bash
pnpm build:web   # web/dist, ready for any static host
pnpm test:web    # Chromium, against the real Squads program in LiteSVM, with a stand-in for Phantom
```

`web/vercel.json` deploys it as its own project, separate from the landing site, only from `main` (its `ignoreCommand` skips every other branch, previews included), with the security
headers. The owner creates that project and protects its deploys.

### Base adapter

A Safe holds the funds and the Safe Allowance Module caps the hot wallet per day. Neither is ours.

`createEvmAdapter({ chain, rpcUrl, hotWalletKey, safe, usdc, module })` is the `ChainAdapter`:

- `topUpHotWallet` calls `executeAllowanceTransfer` as the delegate itself (an empty signature), so
  the module's cap is the only limit and no relayer is paid.
- `simulate` runs one `eth_simulateV1` block: the Safe, hot wallet and recipient balances, the
  transfer, the three balances again, so before and after are read against the same state.
  guard-core tops the hot wallet up only after the simulation clears, so when the hot wallet holds
  less than the amount, the block starts with the `executeAllowanceTransfer` for the shortfall. The
  Safe must fall by exactly the shortfall and the recipient rise by exactly the amount, or
  `SIM_UNEXPECTED_EFFECT`. A `SIM_FAILED` summary names the call that reverted and its revert
  string; a top-up past the allowance says the allowance cannot cover it.
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
  recipient restriction to turn on, and the transaction guard of Safe 1.4.1, the version we deploy,
  does not see module transactions.
- On mainnet (`BASE_CHAIN_ID=8453`) the scripts refuse a raw `OWNER_PRIVATE_KEY`: the Safe owner
  must be a Ledger (`OWNER_SIGNER=ledger`), below.

#### The Safe owner on a Ledger

`OWNER_SIGNER=ledger` makes `create-safe`, `enable-allowance` and `kill:base` sign as the account at
`OWNER_LEDGER_PATH` (default `44'/60'/0'/0/0`, Ledger Live's first Ethereum account) through the
official `@ledgerhq/hw-app-eth` client. The device signs only the Safe transaction's EIP-712 hash.
A separate `EXECUTOR_PRIVATE_KEY` pays the gas and submits it; it owns nothing, so the most it can
lose is its own ETH, and the owner confirms once per action.

The Ethereum app cannot show a Safe transaction's fields, only two hashes, and it signs hashes only
with **Blind signing** on; otherwise it refuses, and the scripts say to turn it on. Before asking the
device, the scripts print both hashes exactly as the app displays them, `0x` and uppercase hex
(app-ethereum `sign_message_eip712_common/common_712.c`, formatted by the plugin SDK's
`array_bytes_string`), and refuse to sign if their hash differs from the one protocol-kit will
submit:

```
With Blind signing on in the Ethereum app:
The Ledger will show Domain hash:  0x88FB…
                   and Message hash: 0x3C1A…
(safeTxHash 0x…)
Approve only if both match the device exactly. On any difference, reject on the device.
```

For each action:

1. Plug the Ledger in, unlock it and open the Ethereum app.
2. Turn **Blind signing** on (Settings in the Ethereum app).
3. Run the script, for the kill switch `OWNER_SIGNER=ledger pnpm kill:base --yes`.
4. Compare both hashes on the device with the printed ones, character by character. Approve only
   if both match exactly; otherwise reject and treat the computer as compromised.
5. Turn **Blind signing** off again. The script reminds you once the device has signed.

As on Solana, the Safe must be created with the Ledger as owner from the start. The tests drive the
real `hw-app-eth` client against a fake device (`test/evm-ledger.ts`) and check that its signature
recovers to the device address, that the printed hashes are character for character what it would
display, and that it refuses while Blind signing is off.

Safe's official list has no Allowance Module entry for Base Sepolia, so `shared/addresses.ts` lists
it there on a different proof (CR-005): the fork test `test_moduleOnSepoliaIsTheMainnetCode` checks
that its runtime code hash equals the official Base mainnet deployment's. `pnpm check:simulate`
prints the hash on any chain.

#### Fork tests (EVM-6)

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
