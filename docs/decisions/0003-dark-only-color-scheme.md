# 0003 — Dark-only `color-scheme` declaration

**Status:** Accepted  
**Date:** 2026-07-22

## Context

The UI is authored as a fixed dark palette (`--bg: #0f1117`, etc.) but pages did not declare `color-scheme`. Reproduced on **iPad Brave** (not Safari; Windows Brave was fine): force/auto-dark features such as Brave’s experimental **Night Mode** (Chromium “Auto Dark Mode for Web Contents”) invert or recolor already-dark pages, which shows up as white outlines around controls and colors that look almost right but wrong.

## Decision

1. Declare **`color-scheme: dark`** on `:root` / `html` and on native form controls in `styles.css`.
2. Add **`<meta name="color-scheme" content="dark">`** and **`<meta name="theme-color" content="#0f1117">`** on every HTML page.
3. Keep a **single dark theme** — no light theme or user toggle for now.

This is the standard opt-out so browsers treat the document as already dark and skip content auto-darkening.

## Alternatives considered

| Option | Verdict |
|--------|---------|
| Dual `light dark` + `prefers-color-scheme` styles | Rejected — product is intentionally dark; doubles palette maintenance |
| Leave undeclared and fight outlines with per-control CSS | Rejected — does not stop browser force-dark of the rest of the page |
| Document “turn off Night Mode” only | Rejected as sole fix — we should still declare dark correctly for well-behaved engines |

## Consequences

- Form controls and scrollbars use the UA dark palette by default.
- Brave/Chrome should skip auto-dark transforms when they honor `color-scheme: dark`.
- If a browser’s Night Mode ignores the opt-out, users can disable Night Mode for the site; Safari on the same iPad was not affected.
- A future light theme would need both a light palette and a `color-scheme` of `light dark` (or a toggle).
