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
  assets/
    css/styles.css
    js/                         # Application modules
    data/
      image-manifest.json       # S3/local artwork inventory (libretro names + paths)
scripts/
  fetch-images.mjs              # Local libretro mirror → S3
  sync-image-manifest.mjs         # Scan S3/local → image-manifest.json
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

## Artwork setup (libretro → S3)

Game images are **not stored in git**. Upload from a local [libretro thumbnails](https://thumbnails.libretro.com/) mirror, then refresh the manifest.

```bash
npm run fetch-images -- --libretro-dir=/path/to/thumbnails
npm run sync-image-manifest -- --s3-only
npm run deploy
```

Set AWS credentials in `.env` (see `.env.example`). Existing images are skipped on both disk and S3 unless you pass `--force`.

```bash
npm run fetch-images -- --libretro-dir=/path/to/thumbnails --local-only
npm run fetch-images -- --libretro-dir=/path/to/thumbnails --platform=nes
npm run sync-image-manifest -- --local-only
npm run sync-s3-sample-images
```

Images are stored in S3 using libretro directory names:

```
assets/images/<libretroPlaylist>/Named_Boxarts/<filename>.png
assets/images/<libretroPlaylist>/Named_Titles/<filename>.png
assets/images/<libretroPlaylist>/Named_Snaps/<filename>.png
```

Only platforms with games in `image-manifest.json` appear in the platform selector.

GitHub Actions:

- **Sync image manifest** — manual workflow; scans S3 and builds `image-manifest.json`
- **Deploy** — runs on push to `main` (and manually); syncs manifest, then deploys the site

## Deploy to AWS (S3 + CloudFront)

Infrastructure template: [`infrastructure/cloudformation.yaml`](infrastructure/cloudformation.yaml)

1. Deploy the CloudFormation stack in **us-east-1** (see [`infrastructure/README.md`](infrastructure/README.md)).
2. Add GitHub repository secrets from stack outputs: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CLOUDFRONT_DISTRIBUTION_ID`.
3. Push to `main` — `.github/workflows/deploy.yml` syncs manifest + site to S3.

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
- Game search uses `image-manifest.json` (inventory of artwork on S3).
- Browse box art / title screen / in-game in preview before adding to collection.
- Global artwork priority is configurable under Defaults (saved in localStorage).
- Re-run `fetch-images` safely — it skips files that already exist.
