# 0004 — Collection platform browser (viewport sheet)

**Status:** Accepted  
**Date:** 2026-07-23

## Context

The Print column listed every saved card inline under collapsible per-platform `<details>` groups. That made long collections hard to scan on narrow viewports and mixed “which platforms do I have?” with “which cards am I selecting?” in one crowded list.

## Decision

1. **Flat platform list in Print** — show only platforms that have saved cards (icon, name, selection badge). No inline card rows; no collapsible game lists.
2. **Viewport-edge card browser** — selecting a platform opens a sheet fixed to the **screen** (not nested in the Print panel): **right sidebar** on wide viewports (≥1101px), **bottom dock** on narrow. The sheet slides in from that edge.
3. **Full-page blur** — a fixed backdrop dims and blurs the entire page (header + Select · Edit · Print). Dismiss via backdrop click, Escape, or Close.
4. **Directional scroll-snap** — sidebar carousel scrolls **vertically**; dock scrolls **horizontally**. Both use scroll-snap with peeking neighbors.
5. **Selection chrome** — keep global `N cards selected` at the top of Print. Platform row badges show `4 of 12 selected` when any cards on that platform are selected; otherwise total only (`12`).
6. **Full replacement** — no feature flag or dual UI.

Product detail: [`docs/DESIGN.md`](../DESIGN.md) — Print panel + Platform card browser (screen overlay). Issue: [#88](https://github.com/TheRealBenForce/nfc-card-designer/issues/88).

## Alternatives considered

| Option | Verdict |
|--------|---------|
| Keep collapsible `<details>` lists | Rejected — cramped on mobile; weak browse affordance |
| Card browser inside the Print column | Rejected — must pop from screen edge and blur the whole page |
| Single centered card + arrow buttons only | Rejected — scroll-snap with peeking neighbors is the target UX |
| Horizontal carousel in both layouts | Rejected — direction follows sheet orientation (vertical in sidebar, horizontal in dock) |
| Dev toggle / A-B with old list | Rejected — ship as replacement |

## Consequences

- Overlay markup and focus trap live at document/viewport level (reuse native `<dialog>` top layer where practical).
- `renderCollection()` must not destroy open-browser state on every selection/collection event — preserve open platform id, snap index, and focus across re-renders.
- Playwright tests that count `.collection-card` in the main list must open the browser first or assert platform rows instead.
- Copy-in and multi-select semantics stay unchanged; only presentation and navigation change.
