# NFC Card Designer

A client-side single-page app for designing **52 × 84 mm Zaparoo NFC card labels**, optimized for **US letter sticker paper**. Built with vanilla HTML, CSS, and JavaScript — no build step required for the site itself.

## Features

- **17 retro platforms** — Atari 2600 through PlayStation, plus DOS, Sega CD/32X, PC Engine, Neo Geo, and Arcade
- **Game search** — type **3+ letters**, pick a game, **browse artwork types** in preview, then add to collection
- **Libretro thumbnails** — box art, title screens, and in-game snapshots loaded from [libretro-thumbnails](https://github.com/libretro-thumbnails/libretro-thumbnails) on GitHub (`raw.githubusercontent.com`)
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
      game-catalog.json         # Generated at build/deploy (gitignored)
scripts/
  build-game-catalog.mjs        # GitHub API → game-catalog.json
  verify.mjs                    # Run before merging changes
docs/
  DESIGN.md                     # Current product spec (shipped behavior)
  MAINTAINER.md                 # Architecture & maintainer notes
  decisions/                    # ADRs — why we chose X
```

**Backlog:** [GitHub Issues](https://github.com/TheRealBenForce/nfc-card-designer/issues) (Feature template). See [AGENTS.md](AGENTS.md) for the issue → design → review → implement workflow.

## Local development

ES modules require a local server — opening `src/index.html` directly from disk will not work.

```bash
npm run build-game-catalog   # once per session (or after clone)
npm start
```

Open [http://localhost:8000](http://localhost:8000).

`npm run verify` copies a small test fixture if `game-catalog.json` is missing, then runs unit + UI smoke tests.

```bash
npm run verify   # run before merging changes
```

Product design (current state): [docs/DESIGN.md](docs/DESIGN.md)  
Backlog & new features: [GitHub Issues](https://github.com/TheRealBenForce/nfc-card-designer/issues)  
Maintainer / architecture notes: [docs/MAINTAINER.md](docs/MAINTAINER.md)

## Game catalog

Search uses `src/assets/data/game-catalog.json` — a list of retail-filtered libretro game names per platform (no image paths). The file is **generated**, not committed:

```bash
npm run build-game-catalog
```

Optional: set `GITHUB_TOKEN` for higher GitHub API rate limits when building locally.

Artwork PNGs load at runtime from:

```
https://raw.githubusercontent.com/libretro-thumbnails/<repo>/master/<Named_Boxarts|Named_Titles|Named_Snaps>/<game>.png
```

Only platforms with games in the catalog appear in the platform selector.

## Deploy

GitHub Actions on push to `main`:

- **Deploy to AWS** — builds catalog, syncs `src/` to S3 + CloudFront invalidation
- **Deploy to GitHub Pages** — builds catalog, publishes `src/` (enable Pages with GitHub Actions source in repo settings)

AWS static site deploy also works from your workstation:

```bash
npm run build-game-catalog
npm run deploy
```

Set AWS credentials in `.env` (see `.env.example`). Infrastructure: [`infrastructure/cloudformation.yaml`](infrastructure/cloudformation.yaml)

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

- See [docs/MAINTAINER.md](docs/MAINTAINER.md) for data-file relationships and deploy checklist.
- Game search uses `game-catalog.json` (generated game-name inventory).
- Browse box art / title screen / in-game in preview before adding to collection.
- Global artwork priority is configurable under Defaults (saved in localStorage).
