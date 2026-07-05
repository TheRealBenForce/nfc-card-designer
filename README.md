# NFC Card Designer

A client-side single-page app for designing **52 × 84 mm Zaparoo NFC card labels**, optimized for **US letter sticker paper**. Built with vanilla HTML, CSS, and JavaScript — no build step required.

## Features

- **12 retro platforms** — Atari 2600 through PlayStation, plus Neo Geo and Arcade
- **Game search** — bundled game lists per platform; press **Enter** to add to deck
- **Giant Bomb wiki artwork** — fetches box art, title screens, or game pictures (placeholder on failure)
- **Universal template** — full-bleed artwork + platform logo (emoji) + color strip
- **Deck workflow** — sticky settings, scrollable card list, arrow keys to browse
- **Persistence** — `localStorage` for settings and deck; import/export settings JSON
- **PDF export** — letter-size sheet with cut marks (3×3 cards per page)

## Local development

ES modules require a local server — opening `index.html` directly from disk will not work.

**With Node (recommended):**

```bash
npm start
```

Or without adding anything to the project:

```bash
npx serve -l 8000
```

**With Python (if installed):**

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

## Deploy to GitHub Pages

1. Push to GitHub.
2. **Settings → Pages** → Source: `main` branch, `/ (root)` folder.
3. Site publishes at `https://<username>.github.io/<repository>/`.

## Project structure

```
index.html
styles.css
js/
  main.js           # Entry point
  config.js         # Dimensions and constants
  state.js          # App state
  storage.js        # localStorage + settings import/export
  cardRenderer.js   # Canvas card rendering
  wikiParser.js     # Giant Bomb wiki image parser
  pdfExport.js      # Letter PDF with cut marks
  ui.js             # UI bindings
  data/
    platforms.js    # Platform definitions
    games.js        # Bundled game lists
```

## Card layout

Portrait 52 × 84 mm, split vertically:

- **75% width** — game artwork (cover-fill)
- **25% width** — platform column
  - **75% height** — logo
  - **25% height** — platform color

## Notes

- Giant Bomb has no public API; artwork is parsed from wiki `/Images` pages when CORS allows.
- Neo Geo and Arcade use best-effort parsing; failures show a placeholder image.
- Expand game lists in `js/data/games.js` and platforms in `js/data/platforms.js`.
