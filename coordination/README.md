# Coordination

Owner of this folder: the **manager** session. See [`/CLAUDE.md`](../CLAUDE.md) for the full protocol.

| File                                               | What it is                                                                                  | Who writes                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [`BOARD.md`](./BOARD.md)                           | The task board. Every task has an id, an owner, a status and dependencies                   | each owner updates **only their own rows** |
| [`SESSION_PROMPTS.md`](./SESSION_PROMPTS.md)       | The opening prompt for each session, and which worktree to open it in                       | manager only                               |
| [`HUMAN_TODO.md`](./HUMAN_TODO.md)                 | Things only the human owner can do (keys, accounts, signing, approvals). Written in English | manager only                               |
| `messages/<to>/`                                   | Async inbox per session, files named `<timestamp>-<from>.md`                                | anyone, to anyone                          |
| [`/CHANGES_REQUESTED.md`](../CHANGES_REQUESTED.md) | Proposed SPEC changes. Only the owner approves; the integrator applies                      | anyone proposes                            |

## Rules of thumb

- Read your inbox at the start of every task and after every commit.
- Reply in the sender's inbox; move handled messages into `messages/<you>/done/`.
- Never edit another owner's board row — add a note instead, or send them a message.
- Need something from the human owner? Do not ask him directly. Send a message to
  `messages/manager/` and the manager will ask him.
- Statuses: `todo` | `doing` | `blocked` | `review` | `done`.
