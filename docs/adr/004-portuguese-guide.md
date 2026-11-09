# ADR 004 — the repository is English only

- **Status:** accepted, 2026-11-09. It replaces this ADR's first version, which allowed one Portuguese
  file, `docs/self-host.pt-BR.md`.
- **Context:** CR-011 item 7 asked for a Portuguese self-host guide, and it was added as the one
  exception to the English-only rule. Before the public beta, the owner decided that everything in the
  repository must be in English.

## Decision

- `docs/self-host.pt-BR.md` is removed. `docs/self-host.md` is the only setup guide.
- No file in the repository is in Portuguese, `coordination/HUMAN_TODO.md` included.
- Only the conversation with the owner, outside the repository, is in Portuguese.

## Consequences

One guide to keep current instead of two. Readers who prefer Portuguese use a translation tool on
the English guide.
