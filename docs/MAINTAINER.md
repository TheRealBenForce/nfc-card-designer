# Maintainer notes

Internal reference for future changes to NFC Card Designer. Read this before editing data pipelines, search, or artwork handling.

## Architecture (browser)

```
index.html
  └── assets/js/main.js          # loads catalog + image index, then initUI
        ├── gameCatalog.js       # search (games-by-platform.json)
        ├── imageAvailability.js  # which games are searchable
        ├── imageProvider.js     # resolve PNG paths for a card
        ├── cardRenderer.js      # canvas preview/PDF tiles
        ├── ui.js                # all DOM / events
        ├── state.js             # in-memory settings + collection
        └── storage.js           # localStorage + export/import JSON
```

Node-only scripts live in `scripts/`. They are **not** imported by the site at runtime.

## Three data files (easy to confuse)

| File | Written by | Read by | Purpose |
|------|------------|---------|---------|
| `assets/data/games-by-platform.json` | `fetch-game-list`, `export-games-json` | `gameCatalog.js` | Game **names** for search (retail only by default) |
| `assets/js/data/games.js` | `fetch-game-list`, `fetch-images` | `imageProvider.js`, scripts | Flat catalog + **image path metadata** after download |
| `assets/data/image-availability.json` | `scan-images`, `fetch-images` | `imageAvailability.js` | Which `raGameId`s have PNGs on disk → **search visibility** |

**Search requires both** a catalog entry and an availability entry. A PNG on disk alone is not enough until `npm run scan-images` runs (automatic on `npm start` and end of `fetch-images`).

**Image paths** always prefer:

```
assets/images/platforms/<platformId>/games/<raGameId>/<type>.png
```

Lookups use **`platformId` + `raGameId`**, not `raGameId` alone.

## Typical maintainer workflows

### Refresh everything for one platform

```bash
npm run fetch-game-list -- --platform=game-boy
npm run fetch-images -- --platform=game-boy
npm start   # scan-images runs via prestart
```

### After manually copying PNGs into `assets/images/platforms/`

```bash
npm run scan-images
```

### Before merging UI or script changes

```bash
npm run verify
```

Runs syntax checks, layout/unit tests, and Playwright smoke tests (starts a temp server on port 8765).

## Adding a platform

1. Add entry to `assets/js/data/platforms.js` (`id`, `name`, `emoji`, `defaultColor`, `raConsoleId`, optional `searchAliases`).
2. `npm run fetch-game-list -- --platform=<id>`
3. `npm run fetch-images -- --platform=<id>`
4. Commit `games.js`, `games-by-platform.json`, `image-availability.json`, and downloaded images.

## Settings & export format

- **localStorage keys:** `nfc-card-designer-settings`, `nfc-card-designer-collection`
- **Export file:** `nfc-card-designer.json` (project version `2`)
- **Global settings:** `platformColors`, `imageTypePriority` (default: boxArt → titleScreen → gamePicture), `selectedPlatformId`
- **Per-card:** `platformId`, `gameName`, `raGameId`, `imageType` (chosen in preview before add)

**Planned:** per-platform `imageTypePriority` overrides (not implemented yet).

## Retail-only catalog filter

`fetch-game-list` excludes RA title tags: `~Hack~`, `~Homebrew~`, `~Demo~`, `~Prototype~`, `~Test Kit~`, `~Unlicensed~`, `~Z~`, and `[Subset - …]`. Logic is in `assets/js/retailFilter.js` (shared with scripts).

Pass `--include-non-retail` to opt out.

## GitHub Pages deploy checklist

Commit to `main`:

- [ ] `index.html`, `assets/` (JS, CSS, data JSON)
- [ ] `assets/data/games-by-platform.json` (full catalog if you ran `fetch-game-list`)
- [ ] `assets/data/image-availability.json` (from `scan-images` — required for search on Pages)
- [ ] `assets/images/platforms/` (if you want artwork on the live site)

`.env` is gitignored. The live site never calls the RA API.

## Gotchas discovered in v1

1. **Don't commit test images under `assets/images/`** — use temp dirs in tests (`test-image-scan.mjs`). Real user images at the same path will block `git pull`.
2. **`games-by-platform.json` ≠ `games.js`** — UI search uses JSON; stale JSON = small catalog in the app even after `fetch-game-list`.
3. **`scan-images` scans disk** — not just `games.js` paths. Required when images exist but search says "no artwork".
4. **`fetch-images` Map key** is `platformId:raGameId`, not `raGameId` alone.
5. **Platform search "nes"** also matches SNES and Genesis (`genesis` contains `nes`). Enter re-filters before select.

## npm scripts reference

| Script | Purpose |
|--------|---------|
| `npm start` | `scan-images` then static server :8000 |
| `npm run verify` | Full pre-merge check |
| `npm run fetch-game-list` | RA catalogs → `games.js` + `games-by-platform.json` |
| `npm run fetch-images` | Download PNGs + update `games.js` + `image-availability.json` |
| `npm run scan-images` | Rescan disk → `image-availability.json` only |
| `npm run export-games-json` | Rebuild JSON from existing `games.js` |
