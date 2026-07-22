# Maintainer notes

Internal reference for data pipelines, search, and artwork handling.

## Architecture (browser)

```
src/index.html
  └── assets/js/main.js          # loads catalog, then initUI
        ├── gameCatalog.js       # search from game-catalog.json
        ├── libretroThumbnails.js # GitHub raw URL builders
        ├── imageProvider.js     # resolve GitHub raw URLs for a card
        ├── imageAvailability.js # runtime cache of probed image types for preview
        ├── cardRenderer.js      # canvas preview/PDF tiles
        ├── ui.js                # all DOM / events
        ├── state.js             # in-memory settings + collection
        └── storage.js           # localStorage + export/import JSON
```

Node-only scripts live in `scripts/`. They are **not** imported by the site at runtime.

## Game catalog

| File | Written by | Read by | Purpose |
|------|------------|---------|---------|
| `src/assets/data/game-catalog.json` | `build-game-catalog` (local or CI) | `gameCatalog.js` | Retail-filtered, region-deduped game names per platform (`libretroName` only) |

**Not committed to git** — listed in `.gitignore`. Deploy workflows run `npm run build-game-catalog` before publishing.

Search only includes games present in the catalog. Image URLs are computed at runtime from platform + `libretroName` + `imageType` → GitHub raw URL.

Friendly display names are derived at runtime from `libretroName` (see **Artwork & game catalog** in [`docs/DESIGN.md`](./DESIGN.md)). Catalog build filters and the canonical-vs-friendly split are documented there.

**Large repos (Arcade):** `build-game-catalog` prefers a full recursive Git tree, retries transient GitHub `5xx` errors, then falls back to per-folder trees (`Named_Boxarts` / `Named_Titles` / `Named_Snaps`). The contents API is last resort only — it is incomplete for directories with more than 1000 files.

## Typical maintainer workflows

### Build or refresh the game catalog

```bash
npm run build-game-catalog
```

Optional: `GITHUB_TOKEN` in the environment for higher GitHub API rate limits.

For local dev after a fresh clone:

```bash
npm run build-game-catalog
npm start
```

### Before merging UI or script changes

```bash
npm run verify
```

`verify` copies `scripts/fixtures/game-catalog.sample.json` if the catalog file is missing.

## GitHub Actions

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pages.yml` | `push` to `main`, `workflow_dispatch` | Build catalog → deploy `src/` to GitHub Pages |

## Adding a platform

1. Add entry to `src/assets/js/data/platforms.js` (`id`, `name`, `emoji`, `defaultColor`, `libretroPlaylist`, optional `searchAliases`).
2. Verify `playlistToGitHubRepo(libretroPlaylist)` matches the [libretro-thumbnails](https://github.com/orgs/libretro-thumbnails/repositories) repo name.
3. Add carbon theme mapping in `scripts/fetch-platform-icons.mjs` (or bundled SVG).
4. `npm run fetch-platform-icons`
5. `npm run build-game-catalog --` (or `npm run build-game-catalog`)
6. Commit platform icons only (not `game-catalog.json`).

Platforms with **zero catalog entries** are hidden from the platform selector automatically.

## Settings & export format

- **localStorage keys:** `nfc-card-designer-settings`, `nfc-card-designer-collection`
- **Export file:** `nfc-card-designer.json` (project version `6`)
- **Per-card:** `platformId`, `gameName`, `libretroName`, `imageType`
- **Artwork key:** `libretroName` is the exact libretro filename stem used for GitHub raw URLs. `gameName` is a friendly display label derived from `libretroName` on load/save and can change as title cleanup rules evolve without breaking saved artwork.

## Image types → libretro folders

| App type | Libretro folder |
|----------|-----------------|
| `boxArt` | `Named_Boxarts` |
| `titleScreen` | `Named_Titles` |
| `gamePicture` | `Named_Snaps` |

## npm scripts reference

| Script | Purpose |
|--------|---------|
| `npm start` | Static server :8000 |
| `npm run build-game-catalog` | GitHub API → `game-catalog.json` |
| `npm run verify` | Full pre-merge check |
| `npm run fetch-platform-icons` | Carbon theme SVGs → `src/assets/images/platforms/` |
