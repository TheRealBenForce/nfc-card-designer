# Implementation plans (temporary)

Step-by-step coding handoffs for **active** work. Files here are **ephemeral**.

## Lifecycle

```
Feature discussed → draft in DESIGN.md (Backlog, In design)
        ↓
Ready to build → add docs/plans/<feature-slug>.md on the feature branch
        ↓
Implement on the same branch / PR
        ↓
Feature ships → update DESIGN.md to current state (Shipped)
              → distill lasting rationale into docs/decisions/ if needed
              → delete docs/plans/<feature-slug>.md in the same PR
```

**This directory should be empty between features** (except this README).

## When to create a plan

- Multi-file refactors where a coding agent needs ordered steps.
- Features with a clear “delete this file when done” handoff.

## When to delete a plan

In the **same PR** that merges the implementation:

1. Mark the feature **Shipped** in `docs/DESIGN.md` (or remove it from Backlog).
2. Move any “why” that still matters into `docs/decisions/`.
3. **Delete** the plan file. Do not archive under `docs/plans/`.

## Plan template

```markdown
# Plan: <Feature name>

**Status:** Active  
**Design:** [link to DESIGN.md section]  
**Branch:** cursor/<name>-e3a9

## Goal
One paragraph.

## Steps
1. …
2. …

## Done when
- [ ] Acceptance criteria from DESIGN.md met
- [ ] `npm run verify` passes
- [ ] Plan file deleted; DESIGN.md updated
```

## Checklist before merge

- [ ] No `docs/plans/*.md` files except this README
- [ ] `docs/DESIGN.md` describes **current** behavior only (no “remove X” / “planned” language for shipped work)
- [ ] Significant decisions recorded in `docs/decisions/` if applicable
