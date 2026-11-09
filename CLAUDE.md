# AgentGuard — rules for every AI session

Read /SPEC.md before anything. SPEC is the source of truth for interfaces.

## Language (strict)
- The PRODUCT is 100% English: code, comments, UI, Telegram bot messages, MCP tool descriptions, API errors,
  logs, READMEs, docs, ADRs, commits, PRs, BOARD.md, messages between sessions, CHANGES_REQUESTED.md.
- Anything addressed to the HUMAN OWNER is in Portuguese: chat replies to him, questions, status updates,
  requests for him to do something, and /coordination/HUMAN_TODO.md.
- Never mix: no Portuguese inside the product, no English when asking the owner to do something.
- One exception: `docs/self-host.pt-BR.md`, a translation of `docs/self-host.md` (ADR 004). Keep the two
  in step in the same PR.

## Roles
- manager: owns /coordination, talks to the human owner, assigns tasks, never writes product code
- onchain | guard-core | mcp | bot: own ONLY their /packages/<name>
- integrator: owns /packages/shared and /e2e, merges branches, can touch everything during integration

## Coordination protocol (how sessions talk)
- /coordination/BOARD.md: task table: id | owner | status (todo/doing/blocked/review/done) | depends_on | notes.
  Update your rows when you start, block, or finish. Never edit other owners' rows (add a note instead).
- /coordination/messages/<to>/<timestamp>-<from>.md: async messages to another session
  (e.g. messages/guard-core/2026-11-03T10-00-onchain.md). Check your inbox at the start of every task
  and after every commit. Reply in the sender's inbox. Archive handled messages to messages/<you>/done/.
- /coordination/HUMAN_TODO.md: things only the owner can do (keys, accounts, signing, approvals).
  Only the manager writes here; other sessions ask the manager via messages/manager/.
- /CHANGES_REQUESTED.md: proposed SPEC changes. Only the owner approves; integrator applies.
- If agent teams messaging is available, use it too, but ALWAYS mirror decisions in these files
  so there is a written record.
- You can READ any package at any time to see what others are producing. You cannot WRITE outside your package.

## Git
- One branch per role (feat/<role>), small commits, Conventional Commits (feat:, fix:, test:, docs:, chore:).
- Open a PR to main when a task is done; integrator reviews and merges. Never force-push main.
- Pull main often and rebase your branch to see others' merged work.

## Code standards
- TypeScript strict, ESM, Node 20+. No `any` (use `unknown` + zod). No floats for money: bigint only.
- Each package layout: src/ (domain/, adapters/, http/ or tools/, index.ts), test/, README.md, .env.example.
- Domain logic is pure and has no I/O. I/O lives in adapters behind interfaces (easy to mock).
- Validate every external input with zod at the boundary. Typed errors with codes from SPEC.
- ESLint + Prettier shared config at root; `pnpm lint`, `pnpm typecheck`, `pnpm test` must pass before any PR.
- Tests: vitest; coverage >= 90% on domain/ (policy engine, amount math, parsers).
- Logging: pino, structured JSON, never log secrets, keys, full headers or signatures.
- Small files (< 300 lines), small functions, clear names. Comments explain why, not what.
- Code must not read as machine-written. No comment narrating what the next line does, no abstraction
  nobody asked for, no boilerplate padding, no defensive wrapper around a call that cannot fail. One
  job per function, short names, and a comment only where the reason is not obvious from the code.
  If a reviewer could delete a line without losing meaning, it should not be there.
- Architecture decisions: write a short ADR in /docs/adr/NNN-title.md.
- CI (GitHub Actions): lint + typecheck + test on every PR; Foundry tests for /packages/onchain.
