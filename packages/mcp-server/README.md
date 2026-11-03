# @agentguard/mcp-server

An MCP server that lets any agent pay **only** through guard-core. It holds no keys and no policy logic:
it is a thin, safe proxy.

- **Owner:** Session 3 (mcp). This session edits only this package.
- **Tasks:** MCP-1 .. MCP-7 in [`/coordination/BOARD.md`](../../coordination/BOARD.md).
- **Source of truth:** [`/SPEC.md`](../../SPEC.md).

## Tools

| Tool           | Input                                              |
| -------------- | -------------------------------------------------- |
| `paid_fetch`   | `{ url, method?, headers?, body?, maxAmountUsd? }` |
| `transfer`     | `{ to, amountUsd, reason }`                        |
| `get_budget`   | `{}`                                               |
| `check_intent` | `{ intentId }`                                     |

USD inputs are converted to USDC atomic units with `bigint` math (6 decimals). Negative, `NaN` and
over-precise values are rejected before the request leaves this package.

Tool descriptions tell the model plainly that a payment may be rejected or may need owner approval, and
that on `pending_approval` it should tell the user and poll `check_intent`.

Results from `paid_fetch` are **untrusted data**: they are wrapped so the model sees them as content,
never as instructions.

## Transports

stdio and streamable HTTP, via the official `@modelcontextprotocol/sdk`.

## Setup

```bash
cp .env.example .env     # GUARD_URL, AGENT_ID, AGENT_TOKEN
pnpm --filter @agentguard/mcp-server test
```

Client configuration examples (Claude Desktop, Claude Code and other MCP clients) belong in this README
under task MCP-6, along with `examples/demo-agent` from MCP-7.
