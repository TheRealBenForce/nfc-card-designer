# 0003 — Select · Edit · Print designer columns

**Status:** Accepted  
**Date:** 2026-07-22

## Context

The designer home used three panels named Controls, Preview, and Collection. Naming did not match the user job (pick material → customize → print). The center panel stayed partly interactive with no game loaded (calibration, card customization, and artwork controls via leftover `previewCardId` after add). Collection also retained an edit-in-place path (`targetCardId` / “Update Card”) alongside copy-in, which blurred “add a new card” vs “mutate a saved row.”

## Decision

1. **Name the columns Select · Edit · Print** (left → center → right). Each panel has a centered, pronounced section title. Drop the redundant “Collection” heading; the saved card list lives under Print.
2. **Gate the entire Edit column** until a game is loaded via Select (search) or Print (copy-in). While OFF: show the idle `.preview-skeleton` on the card frame; hide or inert the rest of Edit as one unit (`aria-disabled` on the panel). Do not leave calibration / artwork / add controls available through per-control exceptions or `previewCardId` fallback.
3. **Copy-in only from Print** — no in-place edit of collection rows (no ✎, no “Update Card”, no `targetCardId`). Copy-in always starts a new add session.
4. **Responsive layout is binary:** three columns side-by-side, or one column with three rows (Select → Edit → Print). No intermediate 2+1 arrangement.

Product detail: [`docs/DESIGN.md`](../DESIGN.md) — Designer page.

## Alternatives considered

| Option | Verdict |
|--------|---------|
| Keep Controls / Preview / Collection names | Rejected — weak mental model for the print workflow |
| Per-control `disabled` while showing idle chrome | Rejected — Edit must read as fully OFF until a game is loaded |
| Edit-in-place (✎ / Update Card) plus copy-in | Rejected — two ways to change a card; copy-in + add is enough |
| Intermediate responsive breakpoints (2 columns then 1) | Rejected — uneven stacking is harder to scan |

## Consequences

- Remove residual `targetCardId` / `getEditingCard` / “Update Card” code paths in `ui.js`.
- Edit ON/OFF must key off active browse session (`browseState`), not collection `previewCardId` after add/clear.
- Idle and load states share the same `#preview-skeleton` element.
- Implementers follow the PR review checklist; verify with `npm run verify`.
