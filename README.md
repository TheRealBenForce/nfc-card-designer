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

The live site **does not** call the RetroAchievements API. Download images once on your machine and commit them to the repo.

```bash
cp .env.example .env
# Edit .env — see notes below
npm install
npm run test-ra-auth    # verify credentials first
npm run fetch-images
```

### `.env` credentials

Get both from https://retroachievements.org/controlpanel.php:

| Variable | Where to find it |
|----------|------------------|
| `RA_USERNAME` | Your **login** username (what you sign in with) |
| `RA_API_KEY` | Settings → Keys → **Web API Key** (click to copy) |

Common causes of HTTP 401:

- Copied the wrong key (connect token ≠ Web API Key)
- Username is a display name, not your login username
- Extra quotes or spaces in `.env` (don't wrap values in quotes)
- Key was reset on the website but `.env` still has the old key

Bypass `.env` file issues (PowerShell):

```powershell
$env:RA_USERNAME="YourLoginUsername"
$env:RA_API_KEY="paste_web_api_key"
npm run test-ra-auth
```

Save `.env` as **UTF-8** in your editor (not UTF-16). RA keys are typically **32 characters** — if you see 33, there may be a hidden character; the script now strips whitespace automatically.

Docs: https://api-docs.retroachievements.org/getting-started.html

## Deploy to GitHub Pages

1. Push to GitHub (including `assets/images/games/` if you fetched artwork).
2. **Settings → Pages** → Source: `main` branch, `/ (root)` folder.
3. Site publishes at `https://<username>.github.io/<repository>/`.

## Card layout

Portrait 52 × 84 mm (long edge = height). First split is **vertical** (long-edge to long-edge):

```
┌────────────────────────────┬───────┐
│                            │ LOGO  │
│        ARTWORK (75%)       │ (75%  │
│        full height         │ of    │
│                            │ col)  │
│                            ├───────┤
│                            │ COLOR │
└────────────────────────────┴───────┘
         ~75% width            ~25%
```

- **Left ~75%** — game artwork (cover-fill, full card height)
- **Right ~25%** — platform column, split by height:
  - **Top ~75%** — logo
  - **Bottom ~25%** — platform color

## Notes

- Expand game lists in `assets/js/data/games.js` (each game needs a `raGameId` from RetroAchievements).
- Verify `raGameId` values at `https://retroachievements.org/game/<id>`.
- Neo Geo and Arcade titles may need manual `raGameId` curation.
