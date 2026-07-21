# AGENTS.md

## Design document workflow

Product intent and feature specs live in **[`docs/DESIGN.md`](docs/DESIGN.md)**. Use it as the collaboration surface before implementing new behavior.

- **Read `docs/DESIGN.md`** when the user discusses features, roadmap, or design-doc changes.
- **Update `docs/DESIGN.md`** when the user describes new intent — draft or extend the relevant section, set status to **In design**, and clarify open questions.
- **Wait for explicit go-ahead** (e.g. "build it", or status **Ready to build**) before implementing design-doc changes unless the user already asked you to implement.
- **On a branch with design-doc edits**, summarize the delta vs `main` and propose an implementation plan from the acceptance criteria.

Technical architecture and maintainer procedures: [`docs/MAINTAINER.md`](docs/MAINTAINER.md).

## Cursor Cloud specific instructions

### What this is
Zaparoo **NFC Card Designer** — a single client-side static web app (vanilla HTML/CSS/JS ES modules). There is **no backend, no database, and no build step**; the site is served directly from `src/`. Persistence is browser `localStorage` (state survives reloads).

Game artwork and search use **libretro thumbnail paths** only. The inventory lives in `src/assets/data/image-manifest.json`, generated from S3 (CI) or local disk via `npm run sync-image-manifest`.

### Running the app (dev)
- `npm start` serves `src/` on **http://localhost:8000**.
- ES modules will not load via `file://`; you must use the dev server.

### Testing / lint / build
- `npm run verify` is the main gate: `node --check` syntax pass + Node unit tests + Playwright (Chromium) UI smoke tests. It spins up its own temp `serve` on port **8765** (override with `VERIFY_PORT`).
- There is **no lint tool** (no ESLint/Prettier) and **no build command** — `node --check` inside `verify` is the closest lint.
- `npm run verify` requires the Playwright Chromium browser to be installed (`npx playwright install chromium`); this is handled by the startup update script.
- Individual `test:*` scripts that hit the UI need a server on :8000 or a `TEST_BASE_URL` env override.

### Gotchas
- Game artwork PNGs are **not in git** and live on S3 under libretro-mirrored paths (`assets/images/<libretroPlaylist>/Named_Boxarts/...`). Card previews render a **PLACEHOLDER** unless local/S3 images are populated. This is expected in a fresh dev environment.
- Maintainer scripts (`fetch-images`, `sync-image-manifest`, `sync-s3-sample-images`, `deploy`) need `.env` AWS credentials. Copy `.env.example` to `.env` when uploading or scanning S3.
- `fetch-images` requires a local libretro mirror via `--libretro-dir=<path>`.
