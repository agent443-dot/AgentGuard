# @agentguard/mcp-server

An MCP server that lets an AI agent pay **only** through AgentGuard. It holds no keys and makes no
policy decisions. It checks the agent's inputs, turns dollars into atomic units of the chain's dollar
(USDC, or USDG on Robinhood Chain), asks guard-core, and explains the answer in plain English.

Source of truth: [`/SPEC.md`](../../SPEC.md).

## For agent builders

### Quick setup

One command prints what to paste into your MCP client:

```bash
pnpm --filter @agentguard/mcp-server run setup claude-code   # or claude-desktop, cursor, generic
```

Run it from a checkout with dependencies installed; the config it prints starts the server from that
checkout.

It asks for the AgentGuard URL and the agent id (or takes `--guard-url` and `--agent-id`), then for
the agent token at a hidden prompt. The token is never an argument and is never printed. It is saved
to `~/.agentguard/mcp/<agent id>.token`, readable by you only, and the output names that file in
`AGENT_TOKEN_FILE`:

- `claude-code`: the `claude mcp add … --scope user` command to run;
- `claude-desktop` and `cursor`: the JSON block for the config file, and where that file is;
- `generic`: the variables and the command, for any client that starts a stdio server.

Options:

- `--check` calls `get_budget` with these values first and saves nothing if AgentGuard does not
  accept them.
- `--chain` sets `DEFAULT_CHAIN` in the printed config (default Solana devnet).
- `--name` changes the server's name in the client (default `agentguard`).
- If a token is already saved for that agent, setup asks before replacing it; `--replace` skips the
  question.
- To pipe the token in from a password manager, pass `--guard-url` and `--agent-id` too: the first
  line of stdin is then the token and nothing else is asked.

Setup refuses an `~/.agentguard` or `~/.agentguard/mcp` folder that other users can open, and the
server refuses a token file they can read.

The rest of this section does the same by hand.

### What your agent can and cannot do

The agent **can**:

- pay for an HTTP resource that asks for an x402 payment (`paid_fetch`);
- send dollars to an address (`transfer`) on Solana, Base or Robinhood Chain: USDC, or USDG on
  Robinhood Chain, which has no Circle USDC;
- see what it has spent today and its limits (`get_budget`);
- open a budget for one task, with its own limit, websites and expiry (`start_task`);
- follow a payment through owner approval (`check_intent`).

The agent **cannot**:

- **touch a key.** The hot wallet key lives only in guard-core. This server never sees it, and nothing
  the agent sends can reach it. A leaked agent token lets someone spend within the policy and nothing
  more, and the owner can revoke it.
- **change its own limits.** The owner sets the policy: per-payment and daily maximums, the approval
  threshold, and the allowed recipients, domains, chains and tokens. The agent can read its budget but
  not change it.
- **skip approval.** A payment at or above the owner's threshold waits for the owner on Telegram. The
  agent learns the outcome by polling; it cannot approve anything.
- **pay anyone or any site.** A recipient or domain not on the policy's allowlist is rejected. An
  empty allowlist denies everything.
- **be steered by what it fetches.** A paid response body comes back fenced as untrusted third-party
  data, and the model is told never to follow instructions inside it.

The `reason` an agent gives for a transfer is shown to the owner and never used to decide anything.

### 1. Get an agent token

The owner creates the agent in guard-core and sets its policy. A new agent's policy denies everything
until then.

```bash
pnpm --filter @agentguard/guard-core create-agent my-agent   # prints the token once
```

You need three values: `GUARD_URL` (guard-core, e.g. `http://localhost:8787`), `AGENT_ID` and
`AGENT_TOKEN`. Keep the token in your client's secret store, not in a repository.

### 2. Connect your client

The examples run from a checkout with dependencies installed (`pnpm install` at the repo root).
Replace `/path/to/AgentGuard` with its absolute path.

**Claude Desktop.** Edit `claude_desktop_config.json` (macOS:
`~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`) and restart the app:

```json
{
  "mcpServers": {
    "agentguard": {
      "command": "/path/to/AgentGuard/packages/mcp-server/node_modules/.bin/tsx",
      "args": ["/path/to/AgentGuard/packages/mcp-server/src/main.ts"],
      "env": {
        "GUARD_URL": "http://localhost:8787",
        "AGENT_ID": "my-agent",
        "AGENT_TOKEN": "<agent token>"
      }
    }
  }
}
```

Claude Desktop starts the server from an unspecified directory, so both paths must be absolute.

**Claude Code**, over stdio:

```bash
claude mcp add agentguard \
  -e GUARD_URL=http://localhost:8787 -e AGENT_ID=my-agent -e AGENT_TOKEN=<agent token> \
  -- /path/to/AgentGuard/packages/mcp-server/node_modules/.bin/tsx \
     /path/to/AgentGuard/packages/mcp-server/src/main.ts
```

**Claude Code**, over HTTP, against a server started with `MCP_TRANSPORT=http`:

```bash
claude mcp add --transport http agentguard http://127.0.0.1:8789/mcp \
  --header "Authorization: Bearer <MCP_HTTP_TOKEN>"
```

or in a project's `.mcp.json`:

```json
{
  "mcpServers": {
    "agentguard": {
      "type": "http",
      "url": "http://127.0.0.1:8789/mcp",
      "headers": { "Authorization": "Bearer ${AGENTGUARD_MCP_TOKEN}" }
    }
  }
}
```

**Any stdio client.** Most clients take the same shape as Claude Desktop: a command, its arguments
and an environment. The command is `tsx`, the argument is `src/main.ts`, and the environment needs
`GUARD_URL`, `AGENT_ID` and `AGENT_TOKEN`.

**Any HTTP client.** Start the server once:

```bash
export MCP_HTTP_TOKEN=$(openssl rand -hex 32)
MCP_TRANSPORT=http GUARD_URL=http://localhost:8787 AGENT_ID=my-agent AGENT_TOKEN=<agent token> \
  /path/to/AgentGuard/packages/mcp-server/node_modules/.bin/tsx \
  /path/to/AgentGuard/packages/mcp-server/src/main.ts
```

Point the client at `http://127.0.0.1:8789/mcp` with `Authorization: Bearer <MCP_HTTP_TOKEN>`. The
endpoint is stateless streamable HTTP, so a plain JSON-RPC call works with no session:

```bash
curl http://127.0.0.1:8789/mcp \
  -H "Authorization: Bearer $MCP_HTTP_TOKEN" -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_budget","arguments":{}}}'
```

### Connecting to a hosted guard-core

When guard-core runs on a server (for example on Fly.io), its public listener serves only the agent
routes, `/v1/agent/*`, over HTTPS. The MCP server still runs on the agent's machine over stdio; only
`GUARD_URL` changes.

- **`GUARD_URL` must be `https://`.** Plain `http://` is accepted only for `localhost`, `127.0.0.1`
  and `[::1]`; anything else stops the server at startup. The agent token rides on every request, so
  it must never cross a network in clear text.
- **The token goes in the environment only:** `AGENT_TOKEN` in the client config's `env` block, or
  a variable your shell or secret manager sets. Never put it in the URL; a `GUARD_URL` with
  credentials in it (`https://user:token@…`) is refused. Never put it in `args` either, where any
  process listing shows it. The server reads it only from `AGENT_TOKEN`, or from the file
  `AGENT_TOKEN_FILE` names, which it refuses if others can read it.

**Claude Desktop.** The token is stored in this file, so keep it readable by your user only:

```json
{
  "mcpServers": {
    "agentguard": {
      "command": "/path/to/AgentGuard/packages/mcp-server/node_modules/.bin/tsx",
      "args": ["/path/to/AgentGuard/packages/mcp-server/src/main.ts"],
      "env": {
        "GUARD_URL": "https://<guard-core public host>",
        "AGENT_ID": "my-agent",
        "AGENT_TOKEN": "<agent token>"
      }
    }
  }
}
```

**Claude Code.** Use a `.mcp.json` that reads the token from your environment, so the file can be
committed without it:

```json
{
  "mcpServers": {
    "agentguard": {
      "command": "/path/to/AgentGuard/packages/mcp-server/node_modules/.bin/tsx",
      "args": ["/path/to/AgentGuard/packages/mcp-server/src/main.ts"],
      "env": {
        "GUARD_URL": "https://<guard-core public host>",
        "AGENT_ID": "my-agent",
        "AGENT_TOKEN": "${AGENTGUARD_AGENT_TOKEN}"
      }
    }
  }
}
```

To make transfers without a `chain` default to another chain, add `DEFAULT_CHAIN` to the same `env`
block, for example `"DEFAULT_CHAIN": "eip155:46630"` for Robinhood Chain testnet. It must be a chain
guard-core runs and the agent's policy allows; the server warns at startup if not.

Then set `AGENTGUARD_AGENT_TOKEN` in the shell that starts Claude Code, from your secret manager
rather than typed on the command line. `claude mcp add … -e AGENT_TOKEN=<token>` also works, but it
leaves the token in your shell history.

### The tools

| Tool           | Input                                                          | What it does                                               |
| -------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| `paid_fetch`   | `{ url, method?, headers?, body?, maxAmountUsd?, mandateId? }` | Fetches the URL, paying an x402 request if any             |
| `transfer`     | `{ to, amountUsd, reason, chain?, mandateId? }`                | Sends the chain's dollar to an address                     |
| `get_budget`   | `{}`                                                           | Spend today, limits, chains, task budgets, pause, balances |
| `start_task`   | `{ budgetUsd, domains, recipients?, minutes, reason }`         | Opens a task budget and returns its `mandateId`            |
| `check_intent` | `{ intentId }`                                                 | The current status of one payment                          |

- **Amounts are decimal strings** such as `"0.25"`, never JSON numbers: a number has already been
  through a float by the time it arrives. A sign, an exponent, `NaN`, `Infinity` and more than 6
  decimal places are refused rather than rounded.
- **Chains** are CAIP-2 ids: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` (Solana mainnet),
  `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` (Solana devnet), `eip155:8453` (Base mainnet),
  `eip155:84532` (Base Sepolia), `eip155:4663` (Robinhood Chain) and `eip155:46630` (Robinhood Chain
  testnet). `transfer` without `chain` uses `DEFAULT_CHAIN`. `paid_fetch` takes no chain: the
  website's payment request names one, and the policy decides whether it is allowed.
- **The dollar** is USDC on Solana and Base, and USDG (Paxos) on Robinhood Chain. Both have 6
  decimals, so `amountUsd` means the same on every chain; results name the token they moved.
- **`maxAmountUsd`** caps one `paid_fetch`. The tighter of it and the policy's per-payment limit
  applies.

### Task budgets

For a task that will pay more than once, the agent opens one budget for the whole task with
`start_task`: the most it may spend, the websites and transfer recipients it may pay, and how long it stays open (at most a
day). It then passes the returned `mandateId` to each `paid_fetch` and `transfer` for that task.

- A budget lives inside the policy and never raises it: a payment must fit both.
- One budget per task, not one per payment. The tool descriptions tell the model so.
- A budget at or above the approval threshold waits for the owner, like a payment. The result says
  `pending_approval`; the agent tells the user and calls `get_budget` until the budget is listed as
  open, and stops after 10 minutes.
- `get_budget` lists the open budgets with what each has spent. When the owner runs the agent in
  shadow mode, it also says what the agent would have spent today; nothing of that is paid.
- An owner can require a budget for every payment. Then a payment without `mandateId` is refused.

### Handling `pending_approval`

A payment at or above the owner's approval threshold returns `pending_approval` with an intent id. The
owner has 10 minutes to answer on Telegram.

1. Tell the user the payment is waiting for their approval.
2. Call `check_intent` with the intent id every 15 to 30 seconds.
3. Do **not** repeat the payment while it is pending.
4. Act on the outcome:

| Status     | `transfer`                                                                          | `paid_fetch`                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `approved` | Being sent; keep polling                                                            | Call `paid_fetch` again with **exactly** the same url, method, headers and body. That redeems the approval once and returns the response |
| `executed` | Done; the result has the transaction id, and notes a signed receipt if there is one | Done                                                                                                                                     |
| `rejected` | The owner said no; do not retry                                                     | The owner said no; do not retry                                                                                                          |
| `expired`  | No answer in time; nothing moved                                                    | No answer in time, or the approval was not redeemed before it expired; nothing moved                                                     |
| `failed`   | Approved, but sending failed                                                        | Approved, but paying failed                                                                                                              |
| `shadowed` | Shadow mode: nothing was paid; this is what it would have cost                      | Shadow mode: nothing was paid; the body shown is the site's unpaid answer                                                                |

The tool results already tell the model this. A client that drives the tools without a model should
follow the same steps; [`examples/demo-agent`](./examples/demo-agent/index.ts) does.

### Errors and what to do

Every result starts with the outcome. A tool error (`isError: true`) means the call did not reach a
decision. A rejection is a decision, not an error.

**Reject codes.** A `rejected` payment lists one or more codes, each explained in the result. None is
a reason to retry the same payment; only `MANDATE_REQUIRED` asks for it again, with a `mandateId`.

| Code                                                                                                                               | Meaning                                                                                                | What the agent should do                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `PAUSED`                                                                                                                           | The owner paused payments                                                                              | Tell the user; wait for the owner                                        |
| `PER_TX_EXCEEDED`                                                                                                                  | Above the per-payment limit, or above `maxAmountUsd`                                                   | Pay less, or ask the owner                                               |
| `DAILY_EXCEEDED`                                                                                                                   | Would pass today's limit                                                                               | Wait until 00:00 UTC, or ask the owner                                   |
| `RECIPIENT_NOT_ALLOWED`                                                                                                            | The recipient is not on the allowlist                                                                  | Ask the owner to allow it                                                |
| `DOMAIN_NOT_ALLOWED`                                                                                                               | The website is not on the allowlist                                                                    | Ask the owner to allow it                                                |
| `CHAIN_NOT_ALLOWED`, `TOKEN_NOT_ALLOWED`                                                                                           | The policy does not allow this chain or token                                                          | Use an allowed chain, or ask the owner                                   |
| `OWNER_REJECTED`                                                                                                                   | The owner pressed Reject                                                                               | Do not retry                                                             |
| `MANDATE_REQUIRED`                                                                                                                 | The owner requires every payment to belong to a task budget                                            | Open one with `start_task`, then repeat the payment with its `mandateId` |
| `MANDATE_EXCEEDED`                                                                                                                 | The payment does not fit the task budget: too little left, or a website or recipient it does not cover | Stop and tell the user; open another budget only if they agree           |
| `MANDATE_EXPIRED`                                                                                                                  | The task budget expired, or the owner closed it                                                        | Stop and tell the user; open a new budget only if they still want it     |
| `BREAKER_TRIPPED`                                                                                                                  | Too many payments in one minute, so AgentGuard paused the agent                                        | Stop paying and tell the user; the owner must resume the agent           |
| `APPROVAL_TIMEOUT`                                                                                                                 | The owner did not answer, or the approval was not redeemed                                             | Ask the user before trying again                                         |
| `INVALID_402`                                                                                                                      | The website's payment request was malformed or unsafe                                                  | Do not pay this site; tell the user                                      |
| `SIM_FAILED`, `SIM_UNEXPECTED_EFFECT`                                                                                              | In simulation the transaction failed, or did more than pay                                             | Do not retry; tell the user                                              |
| `APPROVAL_DETECTED`, `PERMIT_DETECTED`, `DELEGATION_DETECTED`                                                                      | Base: the payment would grant standing authority over funds                                            | Do not pay this site; it may be hostile                                  |
| `DELEGATE_DETECTED`, `AUTHORITY_CHANGE_DETECTED`, `ACCOUNT_CLOSE_DETECTED`, `UNKNOWN_PROGRAM_DETECTED`, `HIDDEN_ACCOUNTS_DETECTED` | Solana: the transaction would do more than transfer                                                    | Do not pay this site; it may be hostile                                  |

**Tool errors.**

| The result says                                                | Cause                                                  | What to do                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| `amountUsd: "…" is not a valid USD amount` (or `maxAmountUsd`) | Bad amount format                                      | Send a decimal string like `"2.50"`                                   |
| `amountUsd: a transfer must be more than zero.`                | A zero transfer                                        | Send a positive amount                                                |
| `This server has no dollar token for …`                        | No dollar token configured for that chain              | Use another chain; on Base mainnet the owner sets `BASE_USDC`         |
| `AgentGuard could not be reached or did not answer in time.`   | guard-core is down or slow                             | Call `get_budget` before retrying a payment: it may have gone through |
| `AgentGuard did not accept this agent's credentials.`          | Wrong or revoked `AGENT_TOKEN`                         | The owner fixes the configuration                                     |
| `AgentGuard is rate limiting this agent.`                      | Too many calls to guard-core                           | Wait a minute                                                         |
| `AgentGuard refused the request as invalid (…)`                | guard-core rejected an input                           | Fix the field it names                                                |
| `AgentGuard has no record of that.`                            | Unknown intent id, or one belonging to another agent   | Check the id                                                          |
| `AgentGuard returned an error (HTTP …)`                        | guard-core failed, or the website could not be reached | Call `get_budget` before retrying a payment                           |
| `AgentGuard sent a response this server does not understand.`  | This server and guard-core disagree on the API         | Tell the owner                                                        |
| `The AgentGuard MCP server hit an internal error.`             | A bug in this server                                   | Call `get_budget` before retrying; report it                          |

**HTTP transport only.** Before any tool runs, the endpoint can answer `401` (a missing or wrong
`MCP_HTTP_TOKEN`), `403` (a non-loopback `Host` header on a loopback server), `405` (not a `POST`) or
`429` (rate limited: wait `Retry-After` seconds).

## Configuration

| Variable                | Required    | Default                | Notes                                                                                         |
| ----------------------- | ----------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| `GUARD_URL`             | yes         |                        | guard-core base URL: `https://`, or `http://` to localhost only                               |
| `AGENT_ID`              | yes         |                        | The agent this server pays as                                                                 |
| `AGENT_TOKEN`           | yes\*       |                        | That agent's guard-core bearer token                                                          |
| `AGENT_TOKEN_FILE`      | no          |                        | \*A file holding the token instead, mode 600 (`setup` writes it). `AGENT_TOKEN` wins          |
| `DEFAULT_CHAIN`         | no          | Solana devnet (CAIP-2) | Used by `transfer` when `chain` is omitted. Must be a chain guard-core runs                   |
| `BASE_USDC`             | on Base     |                        | USDC contract on Base mainnet, while shared has no verified address for it; ignored elsewhere |
| `MCP_TRANSPORT`         | no          | `stdio`                | `stdio` or `http`                                                                             |
| `MCP_HTTP_HOST`         | no          | `127.0.0.1`            | HTTP only                                                                                     |
| `MCP_HTTP_PORT`         | no          | `8789`                 | HTTP only                                                                                     |
| `MCP_HTTP_TOKEN`        | with `http` |                        | Bearer token clients must send, ≥ 32 chars                                                    |
| `MCP_HTTP_ALLOW_REMOTE` | no          | `false`                | Must be `true` to bind `MCP_HTTP_HOST` to anything but loopback                               |
| `MCP_HTTP_RATE_LIMIT`   | no          | `60`                   | HTTP requests per minute per client address                                                   |
| `LOG_LEVEL`             | no          | `info`                 | Logs go to stderr as JSON                                                                     |

The config is validated at startup; a bad value stops the server with the field name, never the
value. Logs never contain the tokens. At startup the server also reads the budget, and warns if
`DEFAULT_CHAIN` is not among the chains guard-core runs and this agent may pay on (`chains` in the
budget), or if `DEFAULT_CHAIN` has no dollar token. It warns rather than refuses to start:
guard-core may be down at that moment. Against a guard-core that does not report `chains`, the check
is skipped.

## HTTP transport

Stateless streamable HTTP on `POST /mcp`: each request gets its own MCP server, so nothing is shared
between callers.

- **Loopback by default.** It binds `127.0.0.1`. Any other `MCP_HTTP_HOST` is refused at startup
  unless `MCP_HTTP_ALLOW_REMOTE=true`, so exposing it is a deliberate choice. On a loopback address
  the `Host` header must also be loopback, which stops a web page from reaching the server through
  DNS rebinding.
- **Rate limited** per client address (`MCP_HTTP_RATE_LIMIT`, 60 a minute by default), before the
  token is checked, so failed logins count too. The address is the socket's, never
  `X-Forwarded-For`, which any client can write, and an IPv6 client counts by its /64, since one
  client usually holds the whole block. At most 10,000 clients are tracked at once; past that, new
  clients get `429` until old windows expire, which bounds memory under a flood of fresh addresses. Behind a reverse proxy every request shares the
  proxy's address, so put the per-client limit in the proxy.
- **Every request needs** `Authorization: Bearer <MCP_HTTP_TOKEN>`; whoever holds it spends as this
  agent. Put TLS in front before exposing it beyond the machine.

## Development

```bash
pnpm --filter @agentguard/mcp-server mock-guard   # mock guard-core on :8787, paid test API on :8790
pnpm --filter @agentguard/mcp-server demo         # scripted agent pays for /weather
DEMO_URL=http://127.0.0.1:8790/premium pnpm --filter @agentguard/mcp-server demo   # approval flow
pnpm --filter @agentguard/mcp-server test
```

The mock guard-core implements the SPEC's agent routes with a few fixed rules (see
[`examples/mock-guard/server.ts`](./examples/mock-guard/server.ts)). `/weather` costs $0.01 and
executes. `/premium` costs $2.00 and is approved after 20 seconds; repeat the request to redeem it.
`/free` needs no payment. `/injection` returns a body that tries to give the agent orders.
Credentials are `demo-agent` / `demo-token`.

To click through the tools in the MCP Inspector with the mock running:

```bash
cd packages/mcp-server
npx @modelcontextprotocol/inspector \
  -e GUARD_URL=http://127.0.0.1:8787 -e AGENT_ID=demo-agent -e AGENT_TOKEN=demo-token \
  -- node --import tsx src/main.ts
```

Against a real guard-core, set `GUARD_URL`, `AGENT_ID` and `AGENT_TOKEN` to real values and `DEMO_URL`
to an x402 test API on a domain the agent's policy allows.

```
src/domain/     USD math, chains, reject-code wording, untrusted-content fencing, rate limit (pure)
src/adapters/   guard-core HTTP client; every response is checked with zod
src/tools/      the four MCP tools
src/server.ts   builds the McpServer
src/http.ts     streamable HTTP transport: rate limit, Host check, bearer auth
src/startup.ts  the DEFAULT_CHAIN check
src/main.ts     entry point: config, logger, transport
examples/       mock guard-core, paid test API, demo agent
```
