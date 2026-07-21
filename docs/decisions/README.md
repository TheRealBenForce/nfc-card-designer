# Architecture decisions

Permanent records of **why** we chose an approach. These are not implementation checklists.

| File | Topic | Status |
|------|-------|--------|
| [0001-github-raw-artwork.md](./0001-github-raw-artwork.md) | Game artwork URLs + generated game catalog | Accepted |

## When to add a decision doc

Add `docs/decisions/NNNN-short-title.md` when:

- The choice has long-term consequences (hosting, data shape, deploy pipeline).
- Future contributors might ask “why not X?”
- The rationale should survive after implementation plans are deleted.

Do **not** put removal lists, step-by-step coding instructions, or “planned architecture” here — use the **GitHub issue** and **PR review comments** while work is in flight.

## Format

Use numbered files (`0001-`, `0002-`, …). Each doc should include:

- **Status** — Proposed | Accepted | Superseded
- **Context** — What problem we were solving
- **Decision** — What we chose
- **Consequences** — Tradeoffs and follow-ups

Supersede old decisions with a new ADR; link both ways. Do not delete accepted ADRs unless they were never merged.
