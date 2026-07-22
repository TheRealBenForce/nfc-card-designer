# 0003 — Dark-only `color-scheme` declaration

**Status:** Accepted  
**Date:** 2026-07-22

## Context

The UI is authored as a fixed dark palette (`--bg: #0f1117`, etc.) but pages did not declare `color-scheme`. On iPad (Safari / WebKit) with system Dark Mode, browsers may auto-adjust undeclared pages: native controls get light borders (“white outlines”), and authored colors look close but wrong.

## Decision

1. Declare **`color-scheme: dark`** on `:root` / `html` and on native form controls in `styles.css`.
2. Add **`<meta name="color-scheme" content="dark">`** and **`<meta name="theme-color" content="#0f1117">`** on every HTML page.
3. Keep a **single dark theme** — no light theme or user toggle for now.

## Alternatives considered

| Option | Verdict |
|--------|---------|
| Dual `light dark` + `prefers-color-scheme` styles | Rejected — product is intentionally dark; doubles palette maintenance |
| Leave undeclared and fight outlines with per-control CSS | Rejected — does not stop browser auto-darkening of the rest of the page |

## Consequences

- Form controls and scrollbars use the UA dark palette by default.
- Safari/Chrome should stop applying automatic dark transforms to this already-dark UI.
- A future light theme would need both a light palette and a `color-scheme` of `light dark` (or a toggle).
