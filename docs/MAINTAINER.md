# Maintainer notes

Internal reference for data pipelines, search, and artwork handling.

## Architecture (browser)

```
src/index.html
  └── assets/js/main.js          # loads manifest, then initUI
        ├── gameCatalog.js       # search from image-manifest.json
        ├── imageAvailability.js # runtime cache of probed image types for preview
        ├── imageProvider.js     # resolve libretro image paths for a card
        ├── cardRenderer.js      # canvas preview/PDF tiles
        ├── ui.js                # all DOM / events
        ├── state.js             # in-memory settings + collection
        └── storage.js           # localStorage + export/import JSON
```

Node-only scripts live in `scripts/`. They are **not** imported by the site at runtime.

## Image manifest (inventory only)

| File | Written by | Read by | Purpose |
|------|------------|---------|---------|
| `src/assets/data/image-manifest.json` | `sync-image-manifest`, GitHub Actions | `gameCatalog.js` | Games with artwork in S3/local, keyed by `libretroName` |

Search only includes games present in the manifest. There is no runtime S3 probing for search.

**S3 / local image paths** mirror libretro:

```
assets/images/<libretroPlaylist>/Named_Boxarts/<libretro filename>.png
assets/images/<libretroPlaylist>/Named_Titles/<libretro filename>.png
assets/images/<libretroPlaylist>/Named_Snaps/<libretro filename>.png
```

Lookups use **`platformId` + `libretroName`**.

## Typical maintainer workflows

### Upload artwork from a local libretro mirror

```bash
npm run fetch-images -- --libretro-dir=/path/to/thumbnails --platform=nes
npm run sync-image-manifest -- --s3-only
```

`fetch-images` requires `--libretro-dir`. It uploads PNGs to S3 using libretro directory names. Run `sync-image-manifest` afterward so `image-manifest.json` reflects the inventory.

### Refresh manifest after direct S3 changes

```bash
npm run sync-image-manifest -- --s3-only
```

Options:

| Flag | Effect |
|------|--------|
| `--platform=<id>` | Limit scan to one platform's libretro playlist |
| `--s3-only` | Read S3 only (requires `S3_BUCKET` in `.env`, environment, or `--bucket=`) |
| `--local-only` | Read `src/assets/images/` only |
| `--bucket=<name>` | Override S3 bucket |

By default (no flags), the script merges local disk **and** S3 listings.

### Pull a local random sample cache from S3 (for CORS-safe previewing)

```bash
npm run sync-s3-sample-images
npm run sync-s3-sample-images -- --platform=nes,genesis --count=5
```

### Before merging UI or script changes

```bash
npm run verify
```

## GitHub Actions

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `sync-image-manifest.yml` | `workflow_dispatch`, `workflow_call` | Scan S3 → write `image-manifest.json` artifact |
| `deploy.yml` | `push` to `main`, `workflow_dispatch` | Calls sync-manifest, then deploys site |

Deploy uploads the freshly generated manifest with the site. Game PNGs remain on S3 only (`deploy.mjs` excludes `assets/images/*` except what is bundled under `src/assets/data/`).

## Adding a platform

1. Add entry to `src/assets/js/data/platforms.js` (`id`, `name`, `emoji`, `defaultColor`, `libretroPlaylist`, optional `searchAliases`).
2. Add carbon theme mapping in `scripts/fetch-platform-icons.mjs` (or bundled SVG).
3. `npm run fetch-platform-icons`
4. `npm run fetch-images -- --libretro-dir=<path> --platform=<id>`
5. `npm run sync-image-manifest`
6. Commit platform icons and updated `image-manifest.json` (not game PNGs).

Platforms with **zero indexed artwork** are hidden from the platform selector automatically.

## Settings & export format

- **localStorage keys:** `nfc-card-designer-settings`, `nfc-card-designer-collection`
- **Export file:** `nfc-card-designer.json` (project version `6`)
- **Per-card:** `platformId`, `gameName`, `libretroName`, `imageType`

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
| `npm run verify` | Full pre-merge check |
| `npm run fetch-images` | Local libretro mirror → S3 (and optionally `src/assets/images/`) |
| `npm run sync-image-manifest` | Scan local disk and/or S3 → `image-manifest.json` |
| `npm run sync-s3-sample-images` | Pull random sample images from S3 for local dev |
| `npm run deploy` | Site to S3 + CloudFront invalidation |
