# AGENTS.md

## Cursor Cloud specific instructions

### What this is
Zaparoo **NFC Card Designer** — a single client-side static web app (vanilla HTML/CSS/JS ES modules). There is **no backend, no database, and no build step**; the site is served directly from `src/`. Persistence is browser `localStorage` (state survives reloads).

### Running the app (dev)
- `npm start` serves `src/` on **http://localhost:8000** (its `prestart` runs `scan-images`, which just refreshes an optional metadata file — safe).
- ES modules will not load via `file://`; you must use the dev server.

### Testing / lint / build
- `npm run verify` is the main gate: `node --check` syntax pass + Node unit tests + Playwright (Chromium) UI smoke tests. It spins up its own temp `serve` on port **8765** (override with `VERIFY_PORT`).
- There is **no lint tool** (no ESLint/Prettier) and **no build command** — `node --check` inside `verify` is the closest lint.
- `npm run verify` requires the Playwright Chromium browser to be installed (`npx playwright install chromium`); this is handled by the startup update script.
- Individual `test:*` scripts (see `package.json`) that hit the UI need a server on :8000 or a `TEST_BASE_URL` env override.

### Gotchas
- Game artwork PNGs are **not in git** and live on S3, so card previews render a **PLACEHOLDER** unless local/S3 images are populated. This is expected in a fresh dev environment and does not indicate a failure.
- Maintainer/data scripts (`fetch-game-list`, `fetch-images`, `sync-s3-sample-images`, `deploy`, `test-ra-auth`) need `.env` credentials (RetroAchievements API key, AWS). These are **optional** and not needed to run, test, or demo the app locally. Copy `.env.example` to `.env` only if you use them.
