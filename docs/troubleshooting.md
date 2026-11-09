# Troubleshooting

Problems people hit while setting up and running AgentGuard, each with its fix. Most were met during
our own launch. If yours is not here, open an issue. Report security problems privately, as `SECURITY.md` says.

## Signing page

**"Something went wrong … 403 … Access forbidden" when the page loads a Solana link.**
Public Solana RPCs refuse requests from browsers. Give the page its own RPC key that only works from
your page's domain (Helius and QuickNode can lock a key to a domain), set it as
`SOLANA_MAINNET_RPC` in Vercel for Production, and redeploy.

**"This link is not valid: action: Invalid discriminator value. Expected 'kill' | 'create' |
'add-limit'".** The link's `cluster` does not match its action. Solana links take
`cluster=mainnet-beta` (or `devnet`) with `create`, `add-limit` or `kill`. Robinhood Chain links take
`cluster=robinhood` with `create`, `enable` or `kill`. Rebuild the link from `docs/self-host.md`
step 4.

**The page does not show your hot wallet, or still shows the old one.** Environment variables reach
the page only when it is built. After changing one in Vercel, redeploy Production. Then check what
was actually built: `curl -s https://<your page>/app.js | grep -o 'hot:"[^"]*"'`.

**Vercel: "Resource is limited - try again in 24 hours (… api-deployments-free-per-day)".** The free
plan allows 100 deployments a day, and preview builds count. Wait for the quota to reset; retrying
does not help. `vercel.json` already skips every branch but `main`, so it does not happen in normal
use.

**"already has an allowance … kill it first" when you reload an enable link.** The cap is already
set, and the page refuses to ask for a second signature. Read it back with `pnpm status:robinhood`.

**"This link expired. Use /kill in Telegram for a fresh one."** A kill link works for 15 minutes, so
an old button cannot fire later. Run `/kill` again.

**"Nothing to sign" or "Already killed" after a kill.** That chain has no limit left, so there is
nothing to remove. Check with `/status`. The page refuses a kill link that names a hot wallet other
than the one it was built for.

**On a computer, the bot's "Open … kill in Phantom" button stops on a phantom.com page with a QR
code.** That button is made for the Phantom app on a phone: scan the QR code with it. On a computer
with the Phantom extension, open the signing page directly instead. Use the same link without the
phantom.com part, with a fresh `issued` time, within 15 minutes of `/kill`:
`https://<your page>/?action=kill&cluster=mainnet-beta&multisig=<multisig>&hot=<hot wallet>&issued=$(date +%s)`.

**Phantom says "This dApp could be malicious" when you create the Solana multisig.** The page
partly signs that transaction with a one-time key that creates the multisig, and Phantom's scanner
distrusts that on a new domain. Confirm only on your own signing page, and only when the page's
summary names your wallet as the only member and config authority, with a creation fee of 0 SOL.
Anywhere else, reject.

## Wallet and funds

**Phantom will not send to an address you were given.** It probably is a token mint, such as
`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (USDC), not a wallet. A mint identifies the token and
cannot receive anything. Send to the vault address the signing page printed. On Solana, that is the
vault, not the multisig.

**USDG on Robinhood Chain: which token?** Check that the token is
`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. Other tokens on that chain use the same name.

**Payments fail on an EVM chain with the cap set and the Safe funded.** The hot wallet pays the gas
to draw from the Safe, so it needs a little of the chain's native coin. Send it a little; 0.0005 ETH
covers many draws on Robinhood Chain.

**You gave a devnet address for mainnet.** Never reuse a devnet or testnet key or account on mainnet.
Make new ones, as `docs/self-host.md` step 2 says.

## guard-core, the bot and Fly

**`/status` says a chain still has its limit right after a kill.** Sign the Phantom kill for that
chain. `/kill` alone pauses guard-core but does not touch the chain.

**The bot lacks a button or a command the docs describe.** The bot on Fly is older than the code.
Redeploy it and check the image with `fly status --app <bot app>`. With
`.github/workflows/deploy.yml` and your deploy tokens set, this happens on every merge to `main`.

**A deploy fails with "failed to fetch an image or build from source … error reading from server:
EOF".** Fly's remote builder dropped the connection. Re-run the deploy (or the failed job in
GitHub Actions); nothing changed on the running machine.

**The deploy workflow warns "No FLY_API_TOKEN\_… secret".** The token is missing, or it is a GitHub
_variable_. Variables are visible to anyone who can read the settings. Delete it there, revoke it with
`fly tokens revoke <id>`, make a new one with `fly tokens create deploy -a <app>`, and store it as a
**secret**, in the repository or in an environment limited to `main`.

**`curl` to the admin routes times out.** They are on Fly's private network only. Run
`fly proxy 18787:8787 --app <guard-core app>` in another terminal, then call
`http://127.0.0.1:18787`.

**`pnpm status:robinhood` says "invalid robinhood configuration".** It reads `packages/onchain/.env`.
Set `ROBINHOOD_CHAIN`, `ROBINHOOD_RPC_URL`, `ROBINHOOD_SAFE_ADDRESS` and
`ROBINHOOD_HOT_WALLET_ADDRESS` there, or before the command on the same line.

## GitHub

**Every merge is refused: "Required status check … is expected".** A ruleset names a check that never
runs, often because several check names went into one field. Edit the ruleset and add
`lint / typecheck / test`, `docker images` and `signing page (Playwright)` one at a time, choosing
each from the list.

**A ruleset shows "targeting 0 branches".** It protects nothing. Add a target, Include default
branch, and save.

## Your terminal

**zsh adds `\` before `?` or `&` in a pasted URL.** Its URL quoting does that. Put URLs in single
quotes.

**On Windows.** Use WSL2 with Ubuntu, and clone the repository under `~`, not under `/mnt/c`.
