# ADR 004 — one Portuguese file in the product

- **Status:** accepted, 2026-11-09. The owner approved it as part of CR-011 item 7.
- **Context:** the product is English only (`CLAUDE.md`, Language). Many of the people we launch to
  read Portuguese first, and the self-host guide is where a beginner gives up.

## Decision

`docs/self-host.pt-BR.md` is a Portuguese translation of `docs/self-host.md`. It is the only
Portuguese file in the product.

- The English guide is the source. The translation says so at the top, and where they differ, the
  English one holds.
- Commands, bot messages, UI text, error codes and file names stay in English in the translation,
  exactly as the product shows them.
- A change to `self-host.md` that alters a step updates the translation in the same PR.
- Nothing else is translated: not code, comments, other docs, READMEs or the bot.

## Consequences

Two files to keep in step, so the translation stays short and links to the English READMEs for the
exact commands. If it falls behind, the banner points readers to the English guide.
