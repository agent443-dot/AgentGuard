# @agentguard/mcp-server

An MCP server that lets an agent pay **only** through guard-core. It holds no keys and makes no policy
decisions: it checks inputs, turns dollars into USDC atomic units, calls guard-core's agent API and
explains the answer in plain English.

Owner: Session 3 (mcp). Source of truth: [`/SPEC.md`](../../SPEC.md).

## Tools

| Tool           | Input                                              | Calls                         |
| -------------- | -------------------------------------------------- | ----------------------------- |
| `paid_fetch`   | `{ url, method?, headers?, body?, maxAmountUsd? }` | `POST /v1/agent/x402/fetch`   |
| `transfer`     | `{ to, amountUsd, reason, chain? }`                | `POST /v1/agent/transfer`     |
| `get_budget`   | `{}`                                               | `GET /v1/agent/budget/:agent` |
| `check_intent` | `{ intentId }`                                     | `GET /v1/agent/intents/:id`   |

- **Amounts are decimal strings** (`"0.25"`), not JSON numbers. A JSON number has already been through
  a float by the time it arrives, so its exact value cannot be known. Negative values, exponents, `NaN`,
  `Infinity` and anything with more than 6 decimal places are refused before guard-core is called. A
  value that would have to be rounded is refused, never rounded.
- **`transfer` without `chain`** uses `DEFAULT_CHAIN`. The token is always USDC on that chain, taken
  from `@agentguard/shared`. A chain whose USDC address is not configured is refused.
- **Outcomes**: every result states the status and, on a rejection, each reject code with a short
  explanation. On `pending_approval` the model is told to tell the user and poll `check_intent`.
- **Untrusted content**: a `paid_fetch` body is returned in its own content block, fenced by
  `<untrusted-content id="…">` markers carrying a random nonce, after a notice that it is third-party
  data. Only a well-formed media type is shown from the response headers. Bodies over 100,000
  characters are truncated.

## Configuration

| Variable         | Required    | Default                | Notes                                             |
| ---------------- | ----------- | ---------------------- | ------------------------------------------------- |
| `GUARD_URL`      | yes         |                        | guard-core base URL, e.g. `http://localhost:8787` |
| `AGENT_ID`       | yes         |                        | The agent this server pays as                     |
| `AGENT_TOKEN`    | yes         |                        | That agent's guard-core bearer token              |
| `DEFAULT_CHAIN`  | no          | Solana devnet (CAIP-2) | Used by `transfer` when `chain` is omitted        |
| `MCP_TRANSPORT`  | no          | `stdio`                | `stdio` or `http`                                 |
| `MCP_HTTP_HOST`  | no          | `127.0.0.1`            | HTTP only                                         |
| `MCP_HTTP_PORT`  | no          | `8789`                 | HTTP only                                         |
| `MCP_HTTP_TOKEN` | with `http` |                        | Bearer token clients must send, ≥ 32 chars        |
| `LOG_LEVEL`      | no          | `info`                 | Logs go to stderr as JSON                         |

The config is validated at startup; a bad value stops the server with the field name, never the value.
Logs never contain the tokens.

## Client setup

The examples run from a checkout with dependencies installed (`pnpm install` at the repo root). Replace
`/path/to/AgentGuard` with the absolute path.

### Claude Desktop

`claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows:
`%APPDATA%\Claude\`):

```json
{
  "mcpServers": {
    "agentguard": {
      "command": "/path/to/AgentGuard/packages/mcp-server/node_modules/.bin/tsx",
      "args": ["/path/to/AgentGuard/packages/mcp-server/src/main.ts"],
      "env": {
        "GUARD_URL": "http://localhost:8787",
        "AGENT_ID": "my-agent",
        "AGENT_TOKEN": "<agent token from guard-core>"
      }
    }
  }
}
```

Claude Desktop starts the server from an unspecified directory, so both paths must be absolute.

### Claude Code

stdio, one server per agent:

```bash
claude mcp add agentguard \
  -e GUARD_URL=http://localhost:8787 -e AGENT_ID=my-agent -e AGENT_TOKEN=<token> \
  -- /path/to/AgentGuard/packages/mcp-server/node_modules/.bin/tsx \
     /path/to/AgentGuard/packages/mcp-server/src/main.ts
```

Or over HTTP, against a server started with `MCP_TRANSPORT=http`:

```bash
claude mcp add --transport http agentguard http://127.0.0.1:8789/mcp \
  --header "Authorization: Bearer <MCP_HTTP_TOKEN>"
```

The same in a project's `.mcp.json`:

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

### Other MCP clients

Any client that speaks stdio can launch `tsx src/main.ts` with the three required variables in its
environment. Clients that speak streamable HTTP connect to `http://<host>:<port>/mcp` with
`Authorization: Bearer <MCP_HTTP_TOKEN>`.

## HTTP transport

Stateless streamable HTTP on `POST /mcp`: each request gets its own MCP server, so nothing is shared
between callers. `GET` and `DELETE` answer 405 because there is no session to stream to or close.

- Bound to `127.0.0.1` by default. On a loopback address the `Host` header must also be loopback,
  which stops a web page from reaching the server through DNS rebinding.
- Every request needs `Authorization: Bearer <MCP_HTTP_TOKEN>`; anyone who can call the tools spends as
  this agent. Put TLS in front of it before exposing it beyond the machine.

## Trying it locally

```bash
pnpm --filter @agentguard/mcp-server mock-guard   # mock guard-core on :8787, paid test API on :8790
pnpm --filter @agentguard/mcp-server demo         # scripted agent pays for /weather
DEMO_URL=http://127.0.0.1:8790/premium pnpm --filter @agentguard/mcp-server demo   # approval flow
```

The mock guard-core implements the SPEC's agent routes with a few fixed rules (see
[`examples/mock-guard/server.ts`](./examples/mock-guard/server.ts)): `/weather` costs $0.01 and
executes, `/premium` costs $2.00 and is approved after 20 seconds, `/injection` returns a body that
tries to give the agent orders. Credentials are `demo-agent` / `demo-token`.

To click through the tools in the MCP Inspector with the mock running:

```bash
cd packages/mcp-server
npx @modelcontextprotocol/inspector \
  -e GUARD_URL=http://127.0.0.1:8787 -e AGENT_ID=demo-agent -e AGENT_TOKEN=demo-token \
  -- node --import tsx src/main.ts
```

Against a real guard-core, set `GUARD_URL`, `AGENT_ID` and `AGENT_TOKEN` to real values and `DEMO_URL`
to an x402 test API on a domain the agent's policy allows. A real run needs INT-3.

## Layout

```
src/domain/     USD parsing and formatting, reject-code explanations, untrusted-content fencing (pure)
src/adapters/   guard-core HTTP client; every response is checked with zod
src/tools/      the four MCP tools
src/server.ts   builds the McpServer
src/http.ts     streamable HTTP transport with bearer auth and Host checks
src/main.ts     entry point: config, logger, transport
examples/       mock guard-core, paid test API, demo agent
```

```bash
pnpm --filter @agentguard/mcp-server test
pnpm --filter @agentguard/mcp-server test:coverage
```
