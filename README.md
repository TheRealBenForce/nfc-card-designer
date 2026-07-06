# NFC Card Designer

A client-side single-page app for designing **52 × 84 mm Zaparoo NFC card labels**, optimized for **US letter sticker paper**. Built with vanilla HTML, CSS, and JavaScript — no build step required for the site itself.

## Features

- **12 retro platforms** — Atari 2600 through PlayStation, plus Neo Geo and Arcade
- **Game search** — type **3+ letters**, pick a game, **browse artwork types** in preview, then add to collection
- **Libretro thumbnails** — box art, title screens, and in-game snapshots (bundled locally)
- **Universal template** — full-bleed artwork + platform logo (emoji) + color strip
- **Collection** — cards grouped by platform and game; multi-select, delete, or print PDF
- **Persistence** — `localStorage` plus export/import JSON (settings and all cards)
- **PDF export** — letter-size sheet with cut marks (3×3 cards per page)

## Project structure

```
index.html                 # GitHub Pages entry (must stay at repo root)
assets/
  css/styles.css
  js/                      # Application modules
  data/
    games-by-platform.json      # Game names for search (grouped by platform)
    image-availability.json     # Which games have PNGs (search visibility)
  images/platforms/             # Downloaded artwork (platform/game folders)
scripts/
  fetch-game-list.mjs         # Pull RA catalogs → games.js + games-by-platform.json
  fetch-images.mjs              # Download libretro thumbnails + update games.js + availability
  export-games-json.mjs         # Rebuild games-by-platform.json from games.js
  export-image-availability.mjs  # scan-images: index PNGs on disk
  verify.mjs                    # Run before merging changes
docs/
  MAINTAINER.md                 # Architecture & data-pipeline notes for developers
```

## Local development

ES modules require a local server — opening `index.html` directly from disk will not work.

```bash
npm start
```

Open [http://localhost:8000](http://localhost:8000).

```bash
npm run verify   # run before merging changes (tests + smoke checks)
```

Maintainer / architecture notes: [docs/MAINTAINER.md](docs/MAINTAINER.md)

## Artwork setup (libretro thumbnails)

The live site does not fetch images at runtime. Download thumbnails once on your machine from the [libretro thumbnail CDN](https://thumbnails.libretro.com/) and commit them to the repo.

```bash
npm run fetch-game-list    # full retail catalogs per platform → games.js + JSON
npm run export-games-json  # rebuild retail-only JSON from existing games.js
npm run fetch-images       # download thumbnails + scan-images
npm start                  # runs scan-images automatically, then serves the app
```

Game catalogs still come from the RetroAchievements API (`fetch-game-list`). Only artwork is sourced from libretro thumbnails.

For `fetch-game-list`, copy `.env.example` to `.env` and add your RetroAchievements Web API key:

```bash
cp .env.example .env
npm run test-ra-auth
```

`npm start` and `npm run fetch-images` both refresh `assets/data/image-availability.json` from files on disk. You can also run `npm run scan-images` on its own after copying images manually.

```bash
npm run scan-images
```

Images are stored as:

```
assets/images/platforms/<platformId>/games/<raGameId>/boxArt.png
assets/images/platforms/<platformId>/games/<raGameId>/titleScreen.png
assets/images/platforms/<platformId>/games/<raGameId>/gamePicture.png
```

Optional flags:

```bash
npm run fetch-game-list -- --platform=nes
npm run fetch-game-list -- --with-achievements   # smaller lists (games with achievements only)
npm run fetch-game-list -- --include-non-retail  # include hacks, homebrew, demos, etc.
npm run fetch-images -- --platform=genesis
npm run fetch-images -- --force                  # re-download existing files
```

By default, `fetch-game-list` keeps **retail releases only** and excludes RetroAchievements entries tagged as `~Hack~`, `~Homebrew~`, `~Demo~`, `~Prototype~`, `~Test Kit~`, `~Unlicensed~`, deprecated `~Z~` pages, and `[Subset - …]` entries.

### API key

Get your **Web API Key** from https://retroachievements.org/controlpanel.php → Settings → Keys.

Add to `.env` in the project root (save as **UTF-8** if you use Notepad on Windows):

```env
RETROACHIEVEMENTS_API_KEY=your_key_here
```

## Deploy to GitHub Pages

1. Push to GitHub (including `assets/images/platforms/` if you fetched artwork).
2. **Settings → Pages** → Source: `main` branch, `/ (root)` folder.
3. Site publishes at `https://<username>.github.io/<repository>/`.

## Card layout

Portrait 52 × 84 mm. **Every segment splits long-edge to long-edge** — the cut connects the two long sides of whatever is being divided:

- **Tall segment** (portrait) → horizontal cut → **top | bottom**
- **Wide segment** (landscape) → vertical cut → **left | right**

### Portrait card (current default)

```
┌──────────────────────────────┐
│  LOGO (75%)   │ COLOR (25%)  │  ← platform strip, top ~25%
├──────────────────────────────┤
│                              │
│        ARTWORK (75%)         │  ← bottom ~75%
│                              │
└──────────────────────────────┘
```

- **Top ~25%** — platform strip (wide segment → split left | right):
  - **Left ~75%** — logo
  - **Right ~25%** — platform color
- **Bottom ~75%** — game artwork (cover-fill, full card width)

### Landscape card (same rules)

```
┌────────────────────────────┬───────┐
│                            │ LOGO  │
│        ARTWORK (75%)       │ (75%  │
│                            │ of    │
│                            │ col)  │
│                            ├───────┤
│                            │ COLOR │
└────────────────────────────┴───────┘
```

- **Left ~75%** — artwork
- **Right ~25%** — platform column (tall segment → split top | bottom):
  - **Top ~75%** — logo
  - **Bottom ~25%** — platform color

## Notes

- See [docs/MAINTAINER.md](docs/MAINTAINER.md) for data-file relationships, deploy checklist, and gotchas.
- `fetch-game-list` replaces the starter list with full RetroAchievements retail catalogs and writes both `games.js` and `games-by-platform.json`.
- After fetching locally, **commit both files** so GitHub Pages serves the full catalog — the UI loads games from `games-by-platform.json`, not `games.js`.
- Game search shows up to 100 matches at a time; type more characters to narrow results, or press Enter to preview
- Only games with downloaded artwork appear in search (`assets/data/image-availability.json`, built by `npm run scan-images` or `fetch-images`)
- Browse box art / title screen / in-game in preview before adding to collection
- Global artwork priority is configurable under Defaults (saved in localStorage)
- Re-run `fetch-images` safely — it skips files that already exist.
- Use `--platform=<id>` to fetch one platform at a time (e.g. `nes`, `genesis`).
