# Maintainer notes

Internal reference for future changes to NFC Card Designer. Read this before editing data pipelines, search, or artwork handling.

## Architecture (browser)

```
src/index.html
  └── assets/js/main.js          # loads catalog, then initUI
        ├── gameCatalog.js       # search (games-by-platform.json + artwork filter)
        ├── imageProbe.js        # runtime box-art probing cache for search
        ├── imageAvailability.js # runtime cache of probed image types for preview
        ├── imageProvider.js     # resolve PNG paths for a card
        ├── cardRenderer.js      # canvas preview/PDF tiles
        ├── ui.js                # all DOM / events
        ├── state.js             # in-memory settings + collection
        └── storage.js           # localStorage + export/import JSON
```

Node-only scripts live in `scripts/`. They are **not** imported by the site at runtime.

## Two data files (easy to confuse)

| File | Written by | Read by | Purpose |
|------|------------|---------|---------|
| `src/assets/data/games-by-platform.json` | `fetch-game-list`, `export-games-json` | `gameCatalog.js` | Game **names** for search (retail only by default) |
| `src/assets/js/data/games.js` | `fetch-game-list`, `fetch-images` | `gameCatalog.js`, `imageProvider.js`, scripts | Flat catalog + **image path metadata** after download |

**Search** loads names from `games-by-platform.json`, then keeps only games with artwork:

1. Image paths already present in `games.js` (from `fetch-images`), or
2. A successful runtime probe of `boxArt.png` on S3/local (`imageProbe.js`)

Preview artwork still resolves per card via `imageProvider.js` + `imageAvailability.js`.

**Image paths** always prefer:

```
assets/images/platforms/<platformId>/games/<raGameId>/<type>.png
```

(Published S3/object keys omit `src/`; local checked-in files live under `src/assets/...`.)

Lookups use **`platformId` + `raGameId`**, not `raGameId` alone.

## Typical maintainer workflows

### Refresh everything for one platform

```bash
npm run fetch-game-list -- --platform=game-boy
npm run fetch-images -- --platform=game-boy
npm start
```

### After uploading artwork directly to S3

Sync `games.js` metadata without re-downloading:

```bash
npm run fetch-images -- --platform=atari-2600 --s3-only
```

### Pull a local random sample cache from S3 (for CORS-safe previewing)

```bash
npm run sync-s3-sample-images
npm run sync-s3-sample-images -- --platform=nes,genesis --count=5
```

### Before merging UI or script changes

```bash
npm run verify
```

Runs syntax checks, layout/unit tests, and Playwright smoke tests (starts a temp server on port 8765).

## Adding a platform

1. Add entry to `src/assets/js/data/platforms.js` (`id`, `name`, `emoji`, `defaultColor`, `libretroPlaylist`, optional `raConsoleId` or `catalogSource: "libretro"`, optional `searchAliases`).
2. Add carbon theme mapping in `scripts/fetch-platform-icons.mjs` (or bundled SVG).
3. `npm run fetch-platform-icons`
4. `npm run fetch-game-list -- --platform=<id>`
5. `npm run fetch-images -- --platform=<id>`
6. Commit `games.js`, `games-by-platform.json`, and platform icons (not game PNGs — those live in S3).

Platforms with **zero catalog games** are hidden from the platform selector automatically.

## Settings & export format

- **localStorage keys:** `nfc-card-designer-settings`, `nfc-card-designer-collection`
- **Export file:** `nfc-card-designer.json` (project version `3`)
- **Global settings:** `selectedPlatformId` (reserved panel for future settings)
- **Per-platform defaults** (`platformDefaults`): `color` (from `platforms.js` palette), `imageTypePriority` (default: boxArt → titleScreen → gamePicture), `imageRotation` per image type (default `0°`)
- **Per-card:** `platformId`, `gameName`, `raGameId`, `imageType` (chosen in preview before add)
- **Import migration:** v2 `platformColors` maps into `platformDefaults.color`

Preview still lets users switch artwork types; the platform priority picks which type is selected first.

## Artwork source

Game catalogs come from RetroAchievements (`fetch-game-list`) for most platforms; **DOS** uses libretro thumbnail listings. Box art, title screens, and in-game snapshots are downloaded from the [libretro thumbnail CDN](https://thumbnails.libretro.com/) by `fetch-images` and uploaded to **S3** (`S3_BUCKET`, default `zaparoo.therealbenforce.com`).

`fetch-images` skips images that already exist locally or in S3 unless `--force` is passed. Run `fetch-images` from your workstation; deploy via `npm run deploy` or the GitHub Actions workflow on `main` (site files only).

Image types map to libretro folders:

| App type | Libretro folder |
|----------|-----------------|
| `boxArt` | `Named_Boxarts` |
| `titleScreen` | `Named_Titles` |
| `gamePicture` | `Named_Snaps` |

## Retail-only catalog filter

`fetch-game-list` excludes RA title tags: `~Hack~`, `~Homebrew~`, `~Demo~`, `~Prototype~`, `~Test Kit~`, `~Unlicensed~`, `~Z~`, and `[Subset - …]`. Logic is in `src/assets/js/retailFilter.js` (shared with scripts).

Pass `--include-non-retail` to opt out.

## GitHub Pages deploy checklist

Replaced by AWS deploy — see `infrastructure/README.md` and `.github/workflows/deploy.yml`.

Commit to `main`:

- [ ] `src/index.html`, `src/assets/` (JS, CSS, data JSON, platform icons)
- [ ] `src/assets/data/games-by-platform.json`
- [ ] Game PNGs are uploaded to S3 by CI (`fetch-images`), not committed to git

`.env` is gitignored. The live site never calls the RA API.

## Gotchas discovered in v1

1. **Don't commit test images under `src/assets/images/`** — real user images at the same path will block `git pull`.
2. **`games-by-platform.json` ≠ `games.js`** — search names come from JSON; artwork availability comes from `games.js` paths and runtime probing.
3. **`fetch-images` Map key** is `platformId:raGameId`, not `raGameId` alone.
4. **Platform search "nes"** also matches SNES and Genesis (`genesis` contains `nes`). Enter re-filters before select.
5. **Direct S3 uploads** still need `fetch-images --s3-only` (or a local run against S3) so `games.js` records image paths and search skips failed probes on the next visit.

## npm scripts reference

| Script | Purpose |
|--------|---------|
| `npm start` | Static server :8000 |
| `npm run verify` | Full pre-merge check |
| `npm run fetch-game-list` | RA catalogs → `games.js` + `games-by-platform.json` |
| `npm run fetch-images` | Download libretro thumbnails + update `games.js` |
| `npm run export-games-json` | Rebuild JSON from existing `games.js` |
