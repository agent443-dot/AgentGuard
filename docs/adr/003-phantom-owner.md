# ADR 003 — the Solana owner key in Phantom

- **Status:** accepted, 2026-11-05. The manager approved option 2: a static signing page in
  `packages/onchain`, hosted as its own project on its own subdomain, separate from the landing site.
  It is deployed only from protected `main`, with a strict Content-Security-Policy and no third-party
  scripts at runtime.
- **Date:** 2026-11-05
- **Context:** D4 in [`/LAUNCH.md`](../../LAUNCH.md) is now **Phantom**, a software wallet, for the
  mainnet owner key. The owner has accepted the risk. Exporting the key to a file is ruled out.
- **Scope:** Solana (Squads v4) only. The Base Safe owner is not covered here.

## The problem

The owner is the multisig's only member and its config authority, with threshold 1. Every owner action
is a single instruction signed by that key:

| Action    | Instruction                   | Parameters our scripts set                                                                                                                                           |
| --------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create    | `multisigCreateV2`            | `configAuthority` = owner, `threshold` 1, `members` = [owner, all permissions], `timeLock` 0, a fresh `createKey` that co-signs                                      |
| Add limit | `multisigAddSpendingLimit`    | `createKey` = **the hot wallet's public key**, vault 0, the USDC mint, `amount` = `DAILY_CAP`, `Period.Day`, `members` = [hot wallet], `destinations` = [hot wallet] |
| Kill      | `multisigRemoveSpendingLimit` | the limit at `spendingLimitPda(multisig, hot wallet)`, rent back to the owner                                                                                        |

The adapter, `status` and `kill` all find the limit by deriving its address from the hot wallet's key.
That derivation is what lets every component agree on the limit with no extra configuration. Our
scripts sign with a keypair file or a Ledger, and they cannot sign with Phantom.

## Option 1: the official Squads app (app.squads.so)

The app can't reproduce our setup as it stands, and it's a poor tool for the kill. I'd use it only to
view the multisig and cross-check, not to sign.

What we know, from Squads' docs as search results report them. The docs site can't be reached from
the cloud sessions, so each point needs a check on devnet:

1. **It doesn't give us a controlled multisig.** The config authority is documented only for the SDK
   and the CLI (`--config-authority`). Nothing found says the app sets one. Without it, every change
   is a config _proposal_ that has to be created, approved and executed. With threshold 1 the owner
   does all three, but each is a Phantom confirmation.
2. **It puts the limit at an address we don't derive.** The app's "Add Spending Limit" form takes the
   account, the token, the amount, the period and the destinations. A limit it creates gets its own
   `createKey`, so the limit does not sit at `spendingLimitPda(multisig, hot wallet)`, and the
   adapter, `status` and `kill` would not find it. To accept that, we'd add a `SQUADS_SPENDING_LIMIT`
   setting and change the adapter.
3. **It may make the hot wallet a multisig member.** The docs say a limit "appears on the member's
   card", which suggests the app only offers multisig members as the ones who can draw. Our scripts
   make the hot wallet a spending-limit member _without_ making it a multisig member. If the app needs
   the hot wallet as a multisig member, it must hold no vote permission, or a stolen hot-wallet key
   could approve proposals with threshold 1. **This is the point to check first;** if the app only
   allows a voting member, option 1 is out.
4. **A kill through the app is a proposal.** Removing a limit through the app means creating, approving
   and executing a config proposal. That's at least two Phantom confirmations on a third-party page,
   in the minutes that matter most.

If the devnet check shows the app _can_ create a controlled multisig and add a limit for a non-member,
option 1 becomes the setup path for create and add. Our part is then a checklist, plus `status`
extended to check every field in the table above and fail if any differs. Even then, the kill stays
on option 2.

## Option 2 (recommended): a static signing page we serve

A single static page (HTML plus a bundled script), served from a domain we control. It connects to
Phantom through the Solana wallet adapter. It has no backend, and it never receives transaction bytes
from anywhere.

- **The URL names the action and the public addresses, nothing else.** For example,
  `/sign/kill?cluster=mainnet-beta&multisig=<pda>&hot=<pubkey>`. The page builds the instruction
  itself, with the same builders as our scripts (`removeSpendingLimitInstruction` and its
  create/add counterparts, which are moved into pure functions). The limit address is derived, so
  the kill page and the adapter cannot disagree about which limit is removed.
- **It checks the chain before asking for a signature.** The multisig must exist, and its config
  authority must be the wallet Phantom connected. The limit must exist at the derived address, and its
  members and destinations must be [hot wallet]. Anything else stops the page with the reason; it
  never offers a signature it could not explain.
- **It shows what will be signed, in words and in full.** The action, the cluster, the multisig, the
  limit, the hot wallet, the amount and the period, plus the program id and the instruction name. The
  owner can compare each address with `status` or with the Squads app.
- **It signs with `signAndSendTransaction`.** Phantom simulates and sends in one place (Phantom's docs
  recommend this to avoid false simulation warnings). The page then reads the chain back and shows the
  result, the same lines `status` prints.
- **Create** needs the fresh `createKey` to co-sign. The page generates it in the browser, partly signs
  with it, then asks Phantom to sign. Whether Phantom accepts a partly signed transaction is a
  **devnet check**. If it doesn't, create goes first through option 1, if the app passes, or through a
  two-step create.

### The kill, one tap from Telegram

The bot's kill alert carries an inline URL button pointing at Phantom's universal link,
`https://phantom.app/ul/browse/<url-encoded kill page>?ref=<our origin>`.

- **On a phone**, the button opens the page inside Phantom's own browser, with the wallet already
  connected. The page runs its checks, shows the summary and asks for the signature right away, so
  the owner's next screen is Phantom's confirmation.
- **On a desktop**, the same link opens the page in the browser with the Phantom extension.

So it's one tap in Telegram, then one confirmation in Phantom. The link itself is built from the
multisig and the hot wallet, both public, so the bot holds nothing secret for it.

### Why not a Solana Pay transaction request

Phantom implements Solana Pay transaction requests, but they need a public HTTPS endpoint that returns
the transaction to sign. guard-core is not public, and that endpoint would become the thing to attack:
whoever controls it decides what the owner is asked to sign. Phantom would show only the endpoint's
label and icon, plus its own simulation. A static page that builds the instruction from public
addresses has nothing to inject into. We can keep Solana Pay for later, if a page turns out
impossible on some device.

## Security: what the owner sees, and how they know it's the kill

**What Phantom shows**, from its docs and reports. The exact screens are a **devnet check** with a
fresh Phantom account:

- **The origin of the requesting page.** On the kill this must be our domain; any other domain is a
  phishing page.
- **The result of its own simulation:** the estimated balance changes, and a warning if the
  transaction fails simulation or is flagged as malicious. Phantom bought Blowfish, the simulation
  service it had used.
- **Not, as far as we found, a decoded Squads instruction.** Nothing found says Phantom names the
  instructions of arbitrary programs. So Phantom alone can't tell the owner that this is
  `multisigRemoveSpendingLimit` on our multisig.

**How the owner knows it's the kill, and only the kill:**

1. The Phantom screen names our domain.
2. The page's summary names the multisig and the limit, and both can be checked with `status` or in
   the Squads app.
3. Phantom's simulation should show **no token leaving any account the owner has**. The only change
   should be a small SOL credit to the owner, the limit account's rent coming back. A kill that shows
   USDC or SOL leaving is not our kill, and the owner rejects it.
4. Afterwards the page and `status` show the limit gone, and a draw by the hot wallet fails
   (`AccountNotInitialized`, as `test/cap.test.ts` checks).

**What remains, and is accepted with D4:**

- **A software wallet holds the key.** Whatever compromises the owner's device can sign anything.
  This is the risk the owner accepted. The onchain cap still bounds the hot wallet, but not the owner.
- **The page is a trust root.** Whoever can change the deployed page can ask the owner to sign a
  config change with a harmless-looking summary, such as adding a limit to their own key. Phantom's
  simulation would show no balance change for that either. So the page must be deployed only from
  protected `main`, with a strict Content-Security-Policy, no third-party scripts at runtime, and
  pinned dependencies. The owner should also see the Squads app's view of the multisig after every
  setup change. `status` must flag any limit or member other than the expected ones.
- **A spoofed link in Telegram** opens a page on another domain. Phantom shows that domain, and step 1
  above is how the owner catches it.

### One measured exception: `'unsafe-eval'` (2026-11-06, HUMAN-15)

The first live run on devnet failed at `connect()`, with nothing signed. Phantom injects its provider
into the page's own JavaScript world, where the page's CSP applies to it, and that provider compiles
zod schemas with `new Function`. Under `script-src 'self'` Chrome refuses that, and Phantom's connect
fails with "Internal JSON-RPC error". Nonces, hashes and `'wasm-unsafe-eval'` do not cover
`new Function`, so the page's `script-src` is now `'self' 'unsafe-eval'`.

The exception is limited to that:

- Every other directive is unchanged: `default-src 'none'`, `connect-src` set to the build's RPC
  endpoints only, no other origin for scripts, `frame-ancestors 'none'`.
- `'unsafe-eval'` lets code that already runs turn a string into code. It does not let a script from
  anywhere else run. The page's own code has no such sink, and it writes only `textContent`. An
  attacker still needs a script served from our origin, which is the trust root above in any case.
- The browser tests use a stand-in Phantom that calls `new Function` the same way. A unit test pins
  the whole policy, directive by directive. Removing the exception, or widening the policy any
  further, fails CI.

## Decision proposed

- **Kill:** option 2, the static page reached through the Phantom universal link from the bot's alert.
- **Create and add limit:** the same page. Option 1 is a fallback if the devnet check shows the app can
  produce the exact parameters in the table, including a limit for a non-voting hot wallet. Either
  way, the limit's address must be the derived one or the adapter has to learn a new setting.
- **Afterwards:** `status` checks every parameter onchain and fails on any difference.

## Work, if accepted

- **onchain:**
  - move the create, add and remove instruction builders into pure functions (one exists already);
  - build the `sign/` page (wallet adapter, the checks, the summary), with tests for the builders and
    for the page's checks;
  - make `status` strict.
- **bot:** add the inline URL button on the kill alert, built from the multisig and the hot wallet.
- **integrator / manager:** decided: its own project on its own subdomain, as in the status line.
- **HUMAN, on devnet, with a fresh Phantom account:** run create, add limit and kill through the page;
  record what Phantom shows on each confirmation; and run the option 1 checks (config authority,
  non-member limit, limit address) in the Squads app.

## Checks this draft depends on

| #   | Check on devnet                                                                            | If it fails                                                       |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1   | The Squads app can set a config authority at creation                                      | Option 1 is out for setup                                         |
| 2   | The Squads app can add a limit whose drawer is not a voting member                         | Option 1 is out for setup                                         |
| 3   | Phantom signs and sends a transaction the page has already partly signed (the `createKey`) | Create needs another path; add and kill are unaffected            |
| 4   | What Phantom shows for `multisigRemoveSpendingLimit`: origin, simulation, any decoding     | Rewrite the security section with what it really shows            |
| 5   | The universal link opens the page inside Phantom on iOS and Android, from Telegram         | Fall back to the plain page URL, opened in a browser with Phantom |
