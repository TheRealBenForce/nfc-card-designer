# NFC Card Designer

A client-side single-page app for designing **52 × 84 mm Zaparoo NFC card labels**, optimized for **US letter sticker paper**. Built with vanilla HTML, CSS, and JavaScript — no build step required for the site itself.

## Features

- **12 retro platforms** — Atari 2600 through PlayStation, plus Neo Geo and Arcade
- **Game search** — bundled game lists per platform; press **Enter** to add to deck
- **RetroAchievements artwork** — box art, title screens, and in-game images (bundled locally)
- **Universal template** — full-bleed artwork + platform logo (emoji) + color strip
- **Deck workflow** — sticky settings, scrollable card list, arrow keys to browse
- **Persistence** — `localStorage` for settings and deck; import/export settings JSON
- **PDF export** — letter-size sheet with cut marks (3×3 cards per page)

## Project structure

```
index.html                 # GitHub Pages entry (must stay at repo root)
assets/
  css/styles.css
  js/                      # Application modules
  images/platforms/        # Downloaded artwork (platform/game folders)
scripts/
  fetch-game-list.mjs      # Dev-only: pull full RA catalogs into games.js
  fetch-images.mjs         # Dev-only: download RA images with your API key
```

## Local development

ES modules require a local server — opening `index.html` directly from disk will not work.

```bash
npm start
```

Open [http://localhost:8000](http://localhost:8000).

## Artwork setup (RetroAchievements)

The live site does not call the RetroAchievements API. Download images once on your machine and commit them to the repo.

```bash
cp .env.example .env
# Edit .env — add your Web API Key (see below)
npm run test-ra-auth
npm run fetch-game-list    # full game catalogs per platform → games.js
npm run fetch-images       # download artwork (can take a while)
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
npm run fetch-game-list -- --with-achievements   # smaller lists
npm run fetch-images -- --platform=genesis
npm run fetch-images -- --force                  # re-download existing files
```

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

- `fetch-game-list` replaces the curated starter list with full RetroAchievements catalogs (thousands of games).
- Re-run `fetch-images` safely — it skips files that already exist.
- Use `--platform=<id>` to fetch one platform at a time (e.g. `nes`, `genesis`).
