# NFC Card Designer

A client-side single-page app for designing **52 × 84 mm Zaparoo NFC card labels**, optimized for **US letter sticker paper**. Built with vanilla HTML, CSS, and JavaScript — no build step required for the site itself.

## Features

- **17 retro platforms** — Atari 2600 through PlayStation, plus DOS, Sega CD/32X, PC Engine, Neo Geo, and Arcade
- **Game search** — type **3+ letters**, pick a game, **browse artwork types** in preview, then add to collection
- **Libretro thumbnails** — box art, title screens, and in-game snapshots (hosted on S3, not in git)
- **Universal template** — full-bleed artwork + platform logo (emoji) + color strip
- **Collection** — cards grouped by platform; multi-select, delete, or print PDF
- **Persistence** — `localStorage` plus export/import JSON (settings and all cards)
- **PDF export** — letter-size sheet with cut marks (3×3 cards per page)

## Project structure

```
src/
  index.html
  recognition.html
  supplies.html
  thanks.html
  assets/
    css/styles.css
    js/                      # Application modules
    data/
      games-by-platform.json      # Game names for search (grouped by platform)
    images/platforms/             # Downloaded artwork (platform/game folders)
scripts/
  fetch-game-list.mjs         # Pull RA catalogs → games.js + games-by-platform.json
  fetch-images.mjs              # Download libretro thumbnails + update games.js
  export-games-json.mjs         # Rebuild games-by-platform.json from games.js
  verify.mjs                    # Run before merging changes
docs/
  MAINTAINER.md                 # Architecture & data-pipeline notes for developers
```

## Local development

ES modules require a local server — opening `src/index.html` directly from disk will not work.

```bash
npm start
```

Open [http://localhost:8000](http://localhost:8000).

```bash
npm run verify   # run before merging changes (tests + smoke checks)
```

Maintainer / architecture notes: [docs/MAINTAINER.md](docs/MAINTAINER.md)

## Artwork setup (libretro thumbnails → S3)

Game images are **not stored in git**. `fetch-images` pulls missing thumbnails from the [libretro CDN](https://thumbnails.libretro.com/) (or a local libretro mirror directory) and uploads them to your S3 bucket (`zaparoo.therealbenforce.com`).

```bash
npm run fetch-game-list    # RA catalogs (+ libretro catalog for DOS) → games.js
npm run fetch-images       # download missing thumbnails → upload to S3
npm run deploy             # sync src/ to S3 + CloudFront invalidation (excludes assets/images/*)
```

Set AWS credentials in `.env` (see `.env.example`). Existing images are skipped on both disk and S3 unless you pass `--force`.

```bash
npm run fetch-images -- --local-only   # dev: save to src/assets/images/ only, no S3
npm run fetch-images -- --s3-only      # upload to S3 only, do not keep local image files
npm run fetch-images -- --libretro-dir=/path/to/thumbnails.libretro.com
npm run sync-s3-sample-images          # pull a small random local cache from S3
```

Game catalogs come from RetroAchievements for most platforms; **DOS** uses libretro thumbnail listings (RA does not support DOS).

For `fetch-game-list`, add your RetroAchievements Web API key:

```bash
cp .env.example .env
npm run test-ra-auth
```

Images are stored in S3 at:

```
assets/images/platforms/<platformId>/games/<raGameId>/boxArt.png
assets/images/platforms/<platformId>/games/<raGameId>/titleScreen.png
assets/images/platforms/<platformId>/games/<raGameId>/gamePicture.png
```

Only platforms with games in the catalog appear in the platform selector.

Optional flags:

```bash
npm run fetch-game-list -- --platform=nes
npm run fetch-game-list -- --with-achievements
npm run fetch-game-list -- --include-non-retail
npm run fetch-images -- --platform=genesis
npm run fetch-images -- --force
npm run fetch-images -- --s3-only --force
npm run fetch-images -- --platform=nes --libretro-dir=/path/to/thumbnails.libretro.com --s3-only
npm run sync-s3-sample-images -- --count=10
npm run sync-s3-sample-images -- --platform=nes,genesis --count=5
```

### API key

Get your **Web API Key** from https://retroachievements.org/controlpanel.php → Settings → Keys.

```env
RETROACHIEVEMENTS_API_KEY=your_key_here
```

## Deploy to AWS (S3 + CloudFront)

Infrastructure template: [`infrastructure/cloudformation.yaml`](infrastructure/cloudformation.yaml)

1. Deploy the CloudFormation stack in **us-east-1** (see [`infrastructure/README.md`](infrastructure/README.md)).
2. Add GitHub repository secrets from stack outputs: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CLOUDFRONT_DISTRIBUTION_ID`.
3. Push to `main` — `.github/workflows/deploy.yml` syncs the site to S3 automatically.

Run `fetch-images` from your workstation when you need new artwork uploaded to S3 (not in CI).

Live site: https://zaparoo.therealbenforce.com

## Card layout

Portrait 52 × 84 mm. **Every segment splits long-edge to long-edge** — the cut connects the two long sides of whatever is being divided:

- **Tall segment** (portrait) → horizontal cut → **top | bottom**
- **Wide segment** (landscape) → vertical cut → **left | right**

### Portrait card (current default)

```
┌──────────────────────────────┐
│  LOGO (75%)   │ COLOR (25%)  │  ← platform strip, top ~15% (default)
├──────────────────────────────┤
│                              │
│        ARTWORK (85%)         │  ← bottom ~85% (default)
│                              │
└──────────────────────────────┘
```

- **Top ~15%** — platform strip (wide segment → split left | right):
  - **Left ~75%** — logo
  - **Right ~25%** — platform color
- **Bottom ~85%** — game artwork (cover-fill, full card width)

### Landscape card (same rules)

```
┌────────────────────────────┬───────┐
│                            │ LOGO  │
│        ARTWORK (85%)       │ (75%  │
│                            │ of    │
│                            │ col)  │
│                            ├───────┤
│                            │ COLOR │
└────────────────────────────┴───────┘
```

- **Left ~85%** — artwork
- **Right ~15%** — platform column (tall segment → split top | bottom):
  - **Top ~75%** — logo
  - **Bottom ~25%** — platform color

## Notes

- See [docs/MAINTAINER.md](docs/MAINTAINER.md) for data-file relationships, deploy checklist, and gotchas.
- `fetch-game-list` replaces the starter list with full RetroAchievements retail catalogs and writes both `games.js` and `games-by-platform.json`.
- After fetching locally, **commit both files** so deploys include the full catalog — the UI loads games from `games-by-platform.json`, not `games.js`.
- Game search shows up to 100 matches at a time; type more characters to narrow results, or press Enter to preview
- Search uses the game catalog; artwork is resolved at preview time from S3/local image paths
- Browse box art / title screen / in-game in preview before adding to collection
- Global artwork priority is configurable under Defaults (saved in localStorage)
- Re-run `fetch-images` safely — it skips files that already exist.
- Use `--platform=<id>` to fetch one platform at a time (e.g. `nes`, `genesis`).
