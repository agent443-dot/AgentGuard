# Proposed SPEC changes

[`/SPEC.md`](./SPEC.md) is the source of truth and **no session changes it on its own**. If you need a
different interface, a verified address, or a decision that contradicts the SPEC, append a proposal
here. The manager presents it to the owner; only the owner approves; the integrator applies the
approved change and bumps the SPEC version.

Keep each proposal short and specific. Do not edit someone else's entry — add your own below it.

## Template

```markdown
### CR-00n — <short title>

- **From:** <session role>
- **Date:** <YYYY-MM-DD>
- **What:** the exact change, with the current text and the proposed text
- **Why:** what breaks or cannot be built without it
- **Blast radius:** which packages and tasks are affected
- **Status:** proposed | approved | rejected | applied
```

Verified addresses go here too, with a link to the official source, so the integrator can add them to
`packages/shared/src/addresses.ts` (task INT-1). Never guess an address.

---

## Open proposals

_None yet._
