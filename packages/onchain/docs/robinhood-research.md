# RH-1 — Robinhood Chain research (CR-007)

- **Date:** 2026-11-07, updated the same day with the owner's HUMAN-18 reads
- **For:** the manager and the integrator, before any Robinhood adapter code
- **Evidence on-chain:** `forge/RobinhoodProbe.t.sol`. CI's forge job forks both chains through their
  public RPCs and fails on any difference from the values below. It passed on PR #91.

**Source tags:**

- **official**: published by the party that owns the value (Robinhood, Safe, Paxos), or read from the
  chain itself.
- **third-party**: anyone else.
- **via search**: an official page that the cloud sessions cannot open, quoted by a search result. Such
  values were then checked on-chain where marked.

## Verdict

Nothing blocks a Robinhood Chain adapter on our current design:

- the same Safe 1.4.1 and Allowance Module 0.1.1, at the canonical addresses, with byte-identical code;
- USDG implements EIP-3009 with the domain ("Global Dollar", "1"), so x402 `exact` works;
- the public RPCs serve `eth_simulateV1`.

The owner confirmed both USDG addresses on Paxos's pages, and read Robinhood's contract list, which
has no USDC (HUMAN-18, 2026-11-07). No research question is left open.

## (a) Chain ids, RPC, explorer

| Network | Chain id | Public RPC                                | Explorer                                       |
| ------- | -------- | ----------------------------------------- | ---------------------------------------------- |
| Testnet | 46630    | `https://rpc.testnet.chain.robinhood.com` | `https://explorer.testnet.chain.robinhood.com` |
| Mainnet | 4663     | `https://rpc.mainnet.chain.robinhood.com` | `https://robinhoodchain.blockscout.com`        |

Sources:

- **Robinhood's docs** (official, via search): `docs.robinhood.com/chain/connecting` gives the testnet
  values. The mainnet values come from search results quoting Robinhood and Blockscout.
- **viem 2.57.16** (third-party, the version we pin): `robinhoodTestnet` and `robinhood` have the same
  ids, RPCs and explorers. viem also lists `https://rpc.ordofi.network` as a second mainnet RPC, which
  we do not use.
- **On-chain** (official): the probe asserts `block.chainid` is 46630 and 4663 on the two public RPCs.
- **Other**: Robinhood Chain is an Arbitrum Orbit L2 with ETH for gas (BitGo's developer docs,
  third-party). A testnet faucet is at `faucet.testnet.chain.robinhood.com` (Robinhood support,
  official, via search).

## (b) Safe 1.4.1 and the Allowance Module

These are in the official lists, so there is no self-deploy. CI checked each code hash on both chains:

| Contract                           | Address                                      | Code hash (both chains)                                              |
| ---------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| SafeL2 1.4.1                       | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` | `0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff` |
| SafeProxyFactory 1.4.1             | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` | `0x50c3cdc4074750a7a974204a716c999edd37482f907608d960b2b025ee0b3317` |
| CompatibilityFallbackHandler 1.4.1 | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` | `0x7c6007a5d711cea8dfd5d91f5940ec29c7f200fe511eb1fc1397b367af3c42f9` |
| Allowance Module 0.1.1             | `0xAA46724893dedD72658219405185Fb0Fc91e091C` | `0x7aa63affdca06fe94576f00077ad61a02ccf203a5da31e1b4ed595df7b65cf3e` |

Sources:

- **`@safe-global/safe-deployments` 1.37.67** (official, npm, 2026-11-05): the v1.4.1 files list
  `4663` and `46630` as `canonical`. The expected code hashes come from the same files.
- **`@safe-global/safe-modules-deployments` 3.0.14** (official, npm): `allowance-module` v0.1.1 lists
  both chain ids at the address above. Its code hash equals Base mainnet's from CR-005, so the module
  is the one we already test.
- **On-chain** (official): `test_testnet` and `test_mainnet` require each hash above.

## (c) USDG

| Network | USDG                                         | Supply control                               |
| ------- | -------------------------------------------- | -------------------------------------------- |
| Testnet | `0x7E955252E15c84f5768B83c41a71F9eba181802F` | `0x4549bb98c667aAb626627C118102c28065E8f54C` |
| Mainnet | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | `0xdf5FfF9cb88B3cAb50572FAE73E2EB08599D25D4` |

- **Addresses**: from Paxos's "USDG on Test Networks" and "USDG on Main Networks" pages (official).
  The owner read both pages and confirmed both addresses (HUMAN-18, 2026-11-07). The on-chain checks
  below prove these contracts behave as Paxos's code says.
- **Not the token: the OFT `0x0d54755f5106BfdB43f7a35f5D49a23F940628d1`.** Paxos's mainnet page also
  lists it, and the owner confirmed it there. It is the contract Paxos lists as USDG's OFT (LayerZero's cross-chain token
  standard), not the token. We never pay in it, it never goes into `shared/addresses.ts` as the token, and a payment
  naming it as the asset is refused like any other non-USDG address.
- **Decimals 6**: from `USDG.sol` in `paxosglobal/paxos-token-contracts` (official, commit `674ac10`),
  and on-chain on both chains.
- **EIP-3009: yes.**
  - `TokenExtensionsFacet.sol` implements `transferWithAuthorization`, `receiveWithAuthorization`,
    `cancelAuthorization` and `authorizationState` (official, same repo).
  - On-chain: a zero-value `transferWithAuthorization`, signed over the domain below, marked its nonce
    used on both chains.
- **EIP-712 domain**: name `"Global Dollar"` and version `"1"`, with `chainId` and `verifyingContract`.
  - Source: `ClaimableRewardsBase.sol` builds `_makeDomainSeparator(name(), "1")` (official).
  - On-chain, `DOMAIN_SEPARATOR()` equals the hash of exactly that domain: testnet
    `0xb1debe91e09d82163fd9cddaab89359061c0671664e1611258a3c3de7c2d950b`, mainnet
    `0x7a3d7400b27830f4f91c2c16a082486d67c1befecaec2f53b33f1f35d5b62036`.
  - The token has no `version()` getter, so an x402 server must send `extra.name = "Global Dollar"` and
    `extra.version = "1"`, and our gate must check both.
- **Things that differ from USDC, for the adapter design:**
  - **A rewards token.** `balanceOf` excludes unclaimed rewards, and rewards move only on an explicit
    claim (`docs/CLAIMABLE_REWARDS_README.md`, official). So `simulate()`'s exact balance checks hold.
    An address Paxos registers to a payout group could receive a claim between two reads, so we check
    this on testnet.
  - **Paxos can freeze addresses.** A transfer to or from a frozen one reverts with `AddressFrozen`.
  - **A reused authorization nonce does not revert.** The token emits `AuthorizationAlreadyUsed` and
    returns, unlike USDC. This matters to a facilitator, not to our signer.
  - **EIP-1271 signatures are accepted** (`SignatureChecker`). That does not change our signer, which
    signs as an EOA.
- **"USDC" and "USDG" copies: an allowlist, not a deny list.** The owner read Blockscout (HUMAN-18).
  - About 45 tokens named "USDC" appear on the first mainnet page alone, some with 50,000 to 70,000
    holders.
  - On testnet, a "USDC" at `0xbf44…275F` (address shortened as the owner read it) has about 170,000
    holders.
  - A third-party source also reports a token reusing the **USDG** symbol at another address.

  A list of copies cannot keep up with that. **The rule is exactly one token per chain: Paxos's USDG
  at the address above.** Anything else is refused, whatever its name or symbol, as `refuse()` already
  does for Base. The bot warns by name when a refused token's symbol is USDC or USDG, because those
  are the ones an agent or a merchant could mistake for ours. **Robinhood Chain has no official USDC.** The owner
  read `docs.robinhood.com/chain/contracts` for mainnet (official). It lists WETH
  `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`, USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (the
  address above) and Robinhood Stock Tokens. It lists no USDC, official or bridged, and says a token
  with a matching name at another address is not canonical. That is the allowlist rule, stated by
  the chain itself.

## (d) eth_simulateV1

**Supported on both public RPCs.** The probe sends `eth_simulateV1` through Foundry's `vm.rpc` to each
fork's RPC, and both answered. A control call to a method that does not exist fails on both, so a
success is evidence. Source: on-chain, the CI log of PR #91.

## (e) @x402/evm 2.29.0

**It accepts `eip155:46630` and `eip155:4663` as they are.** In the v2 code path, `getEvmChainId`
parses any `eip155:<id>` (`src/utils.ts`). The v1 network-name table is not used by v2.

- **Default asset**: `DEFAULT_ASSETS` has no entry for either chain. That table supplies a server's
  default price asset. Our client side does not use it, because the asset comes from the payment
  requirements.
- **Domain name and version**: the client's EIP-3009 path takes them from `requirements.extra` and
  throws when they are missing. Our gate already refuses any domain other than the agreed token's, and
  it needs the USDG values.
- **Upstream**: x402-foundation/x402 PR #3761 adds USDG on 4663 as a default asset (third-party, open,
  not on `main` at `513dd66`). We do not need it.

**What it would take:** `evm/gate.ts` must accept the two chain ids and the USDG domain. That is
adapter work, for after this research.

## Blocked hosts

The cloud sessions cannot reach these hosts, so the owner reads them:

- **Done (HUMAN-18):**
  - `https://docs.paxos.com/guides/stablecoin/usdg/testnet` and
    `https://docs.paxos.com/guides/stablecoin/usdg/mainnet`: both USDG addresses and the OFT address
    confirmed.
  - `https://robinhoodchain.blockscout.com/tokens?q=USDC` and
    `https://explorer.testnet.chain.robinhood.com/tokens?q=USDC`: the copies are too many to list,
    hence the allowlist.
  - `https://docs.robinhood.com/chain/contracts`: no USDC, official or bridged; USDG at the address
    above.
- **Open:** nothing.
- **Not needed now:** `https://developers.circle.com/stablecoins/usdc-contract-addresses`. With the
  allowlist, a Circle USDC would only matter if we chose to accept it, and that would be its own CR.
