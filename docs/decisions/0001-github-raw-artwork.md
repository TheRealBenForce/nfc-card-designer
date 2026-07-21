# 0001 — Game artwork from GitHub raw URLs + generated game catalog

**Status:** Accepted  
**Date:** 2026-07-21

## Context

The designer draws game artwork onto `<canvas>` for preview blur, card composition, and letter-sheet PDF export. That requires CORS-permitted image loads (`crossOrigin = "anonymous"`).

We need a searchable game list per platform without bundling thousands of PNGs in git or operating an image mirror.

## Decision

1. **Artwork** loads at runtime from libretro-thumbnails on GitHub:
   ```
   https://raw.githubusercontent.com/libretro-thumbnails/<repo>/master/<Named_Boxarts|Named_Titles|Named_Snaps>/<libretroName>.png
   ```
   Repo slugs derive from `libretroPlaylist` (`" - "` → `"_-_"`, spaces → `_`).

2. **Game search** uses `src/assets/data/game-catalog.json` — retail-filtered `libretroName` entries only, no image paths. Built by `scripts/build-game-catalog.mjs` (local + deploy CI). **Not committed to git.**

3. **Print export** stays **PDF** (letter size, cut marks, multi-page). No PNG sheet export.

4. **Static site hosting** uses GitHub Pages (GitHub Actions workflow). Serves HTML/JS/CSS + generated catalog only. **No game PNGs** on our infrastructure.

5. **Platform scope** remains the curated **17 platforms** in `platforms.js`.

6. **No runtime GitHub API** in the browser for game lists.

## Alternatives considered

| Option | Verdict |
|--------|---------|
| Self-hosted S3 image mirror | Rejected — operational burden; unnecessary |
| `thumbnails.libretro.com` CDN | Rejected — no CORS for canvas/PDF |
| Artwork PNGs in git | Rejected — repo size |
| Runtime GitHub API in browser | Rejected — rate limits, complexity |

## Consequences

- Fresh clones need `npm run build-game-catalog` (or `npm run verify`, which copies a test fixture).
- Card previews require network access to `raw.githubusercontent.com`.
- Deploy workflows must run `npm run build-game-catalog` before publishing `src/`.
- `libretroName` in the catalog must match GitHub filename stems exactly.
