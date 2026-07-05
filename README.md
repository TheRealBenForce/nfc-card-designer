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
  images/games/            # Downloaded artwork (same-origin for canvas/PDF)
scripts/
  fetch-images.mjs         # Dev-only: download RA images with your API key
```

## Local development

ES modules require a local server — opening `index.html` directly from disk will not work.

```bash
npm start
```

Open [http://localhost:8000](http://localhost:8000).

## Artwork setup (RetroAchievements)

The live site **does not** call the RetroAchievements API (your API key must never ship to GitHub Pages). Instead, download images once on your machine and commit them to the repo:

```bash
cp .env.example .env
# Edit .env and set RA_API_KEY from https://retroachievements.org/controlpanel.php
npm run fetch-images
```

This downloads images into `assets/images/games/` and updates `assets/js/data/games.js` with local paths. Commit the images when you're happy with them.

## Deploy to GitHub Pages

1. Push to GitHub (including `assets/images/games/` if you fetched artwork).
2. **Settings → Pages** → Source: `main` branch, `/ (root)` folder.
3. Site publishes at `https://<username>.github.io/<repository>/`.

## Card layout

Portrait 52 × 84 mm:

- **Top 75%** — game artwork (cover-fill, full width)
- **Bottom 25%** — platform strip split by width:
  - **Left 25%** — platform color
  - **Right 75%** — platform logo

## Notes

- Expand game lists in `assets/js/data/games.js` (each game needs a `raGameId` from RetroAchievements).
- Verify `raGameId` values at `https://retroachievements.org/game/<id>`.
- Neo Geo and Arcade titles may need manual `raGameId` curation.
