# 0005 — Platform defaults edited from Edit, not Select

**Status:** Proposed  
**Date:** 2026-07-24

## Context

Per-platform defaults (accent color, artwork layout, header design) were edited via a ✎ icon on each platform row in Select, opening a dedicated Platform Settings modal. Card-level overrides lived in Edit with a “Reset to Platform Defaults” button. There was no explicit notion of whether a saved card followed platform defaults or had diverged. Saving a look as the platform template required leaving the card editor and opening a separate modal.

## Decision

1. **Remove the platform-row edit icon and Platform Settings modal.** Platform selection in Select is select-only.
2. **Edit is the sole place to shape platform templates.** Add **accent color** and **header design** (show header, show platform strip, header height %) to Edit controls. **Save to platform defaults** writes the current editor state into `settings.platformDefaults` for the active platform.
3. **Single reset affordance: Reset card.** Reverts the card in the editor to saved platform defaults. Disabled when the editor already matches platform defaults. Replaces both “Reset to Platform Defaults” (Edit) and “Reset to system defaults” (modal). Factory reset for a platform is not exposed separately — **Clear** project resets everything to bundled system defaults.
4. **Cards carry `customization: "default" | "customized"`.** Default cards inherit live platform defaults and update when the user saves new platform defaults. Customized cards keep their overrides.
5. **Save to platform defaults** shows a confirmation modal counting how many default cards on that platform will be updated. Customized cards are excluded.
6. **Print carousel (#88)** shows a default vs customized indicator on each card.

Product detail: [`docs/DESIGN.md`](../DESIGN.md) — Platform defaults, Card customization state, Edit panel.

## Alternatives considered

| Option | Verdict |
|--------|---------|
| Keep modal + Edit reset | Rejected — two UIs for the same concept |
| Derive default/customized by field comparison only | Rejected — bulk update needs explicit intent |
| Global header settings (not per platform) | Rejected — header look is part of platform identity |
| Separate “Reset to system defaults” per platform | Rejected — consolidated into Reset card → platform defaults; full factory reset via Clear |

## Consequences

- `platformDefaults` gains `headerSettings`; global `showHeader` / `showPlatformColor` / `headerHeightPercent` migrate out of top-level settings.
- Project export version bumps to **7** with migration for existing collections.
- `platformSettingsModal.js` and related HTML can be removed.
- Save captures per-type rotation for the **active artwork tab** only; artwork priority order stays system-seeded until a reorder UI exists.
- Implementers follow the PR review checklist; verify with `npm run verify`.
