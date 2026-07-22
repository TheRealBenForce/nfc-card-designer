# NFC Card Designer — Design Document

**Status:** Living document (current product state)  
**Last updated:** 2026-07-22  
**Audience:** Product owner + AI assistant collaboration

This document describes **what the app is today**. Planned work lives in **[GitHub Issues](https://github.com/TheRealBenForce/nfc-card-designer/issues)**.

- **Current behavior** → here and in [Shipped features](#shipped-features-summary)
- **Backlog & acceptance criteria** → GitHub Issues
- **Why we chose an approach** → [`docs/decisions/`](./decisions/)
- **How the code works** → [`docs/MAINTAINER.md`](./MAINTAINER.md)

---

## How to use this document (human + AI)

### Workflow

1. **Open a GitHub Issue** — problem, proposal, acceptance criteria (use the Feature template).
2. **Discuss in chat** — reference the issue (`#N`); agent fetches with `gh issue view`.
3. **Update this file on the feature branch** — describe **approved** behavior before or alongside implementation.
4. **Review PR** — frontier model posts implementation comments; add `docs/decisions/` when the rationale should persist.
5. **Merge** — `Closes #N`; issue closes; this file already documents the new current state.

### Document rules

- **Describe what exists**, not what we removed.
- **Do not duplicate the issue backlog here** — issues are the backlog; this file is the shipped product spec.
- **Do not contradict Shipped behavior** unless this document is updated first.

### AI assistant instructions

- **Read the GitHub issue** when the human references `#N` or an issue URL (`gh issue view <n> --comments`).
- **Read `docs/DESIGN.md`** for current product behavior before changing the app.
- **Update shipped sections** when behavior changes; do not add Backlog entries here.

---

## Vision

Help people design and print **52 × 84 mm NFC card labels** — quickly, consistently, and without leaving the browser.

### Users

- **Primary:** People printing NFC sticker sheets at home on US letter paper.
- **Secondary:** Maintainers updating the bundled game-name catalog or platform list (infrequent).

### Goals

- Pick a game, choose artwork, preview a card, collect many cards, export a print-ready letter sheet.
- Stay **client-side only** — no accounts, no backend, persistence via `localStorage` and JSON export.
- Use **libretro thumbnail naming** as the canonical artwork scheme.

### Non-goals

- User accounts, cloud sync, or multi-device collaboration.
- Real-time NFC programming from the browser.
- Bundling game artwork PNGs in git.
- Hosting, mirroring, or syncing game artwork anywhere we control (S3 included). Artwork always loads from libretro’s GitHub raw URLs.
- Exposing every libretro platform in the app (keep the current **17-platform** curated set).
- A build step or SPA framework for the main app.

---

## Design principles

1. **Print fidelity** — On-screen preview and PDF output should match physical card dimensions (52 × 84 mm default).
2. **Platform consistency** — Every card uses the same layout rules; platform identity comes from logo + color strip.
3. **Progressive disclosure** — Simple path: search → preview → add. Advanced controls (per-card artwork alignment, header overrides) stay available but tucked away.
4. **Offline-friendly state** — Collection and settings survive reloads; export/import provides a portable backup.
5. **Inventory-driven search** — Only games listed in the generated `game-catalog.json` appear in search.

---

## Site map & navigation

### Pages

| Page | File | In nav? | Purpose |
|------|------|---------|---------|
| **Designer** (home) | `index.html` | Brand link | Main card designer — search, preview, collection, PDF |
| **Supplies** | `supplies.html` | Yes | Shopping / materials guide for printing and NFC blanks |
| **Recognition** | `recognition.html` | Yes | Credits for artwork, logos, and data sources |
| **Colors** | `colors.html` | No | Internal palette reference (accent + platform default colors) |
| **Developer** | `developer.html` | No | Local dev tools (image delay, local artwork index, collection JSON) |

### Global header (site chrome)

Present on: **Designer**, **Supplies**, **Recognition**, **Developer**.  
**Not present on:** `colors.html`.

| Element | Position | Behavior |
|---------|----------|----------|
| **Brand** | Left | `NFC Card Designer` → links to `./` (designer home) |
| **Supplies** | After brand | Link to `supplies.html`; shown as muted text (current page) on Supplies |
| **Recognition** | After Supplies | Link to `recognition.html`; shown as muted text on Recognition |

**Alignment:** Nav is a horizontal flex row, `align-items: baseline`, `gap: 1rem`, with `padding-left: 0.5rem`. Header has bottom border and surface background. Static content pages wrap body copy in `.site-container` (max-width, centered); the designer page header spans full width above the 3-column grid.

**Not in nav (by design today):** Developer, Colors. Add nav links here only after updating this section and acceptance criteria.

### Appearance (color scheme)

The product UI is **dark-only**. Every page declares `color-scheme: dark` (CSS on `:root` / `html` plus `<meta name="color-scheme" content="dark">`) and a matching `theme-color` (`#0f1117`). That opts browsers into dark native form controls and stops Safari/Chrome auto-darkening from adding white outlines or shifting the palette (notably on iPad with system Dark Mode). There is no light theme today.

---

## Page specifications (shipped)

### Designer — `index.html`

**Status:** Shipped  
**Title:** NFC Card Designer

#### Overall layout

Three-column CSS grid (`.app`), left → center → right:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER: Brand | Supplies | Recognition                                  │
├──────────────┬────────────────────────────────────┬───────────────────────┤
│  CONTROLS    │  PREVIEW                           │  COLLECTION           │
│  (left)      │  (center)                          │  (right)              │
│  260–320px   │  flex / 1fr                        │  220–280px            │
└──────────────┴────────────────────────────────────┴───────────────────────┘
```

- **Desktop:** `grid-template-columns: minmax(260px, 320px) 1fr minmax(220px, 280px)`; full viewport height minus header.
- **≤ 960px:** Stacks to a single column — Controls → Preview → Collection (top to bottom).
- Panels are separated by vertical borders; collection panel has left border only (no right border).

#### Left column — Controls (`panel--controls`)

Top to bottom:

1. **Global Settings** (collapsible `<details>`, collapsed by default)
   - Header Height — range 5–40%, default 15%
   - Card Width (mm) — default 52
   - Card Height (mm) — default 84
   - Sticker Inset (mm) — default 2

2. **Platform Settings** (collapsible `<details>`, collapsed by default)
   - Accent color (color picker)
   - Artwork priority — ordered list (box art / title screen / in-game); drag to reorder
   - Artwork rotation — per-orientation defaults
   - Artwork alignment — 3×3 grid, default top-center
   - Artwork zoom — 50–200%, default 100%
   - Artwork background — mode select + optional eyedropper color

3. **Platform** (always visible section)
   - Scrollable list of platforms with games in the catalog
   - Selecting a platform filters game search to that platform

4. **Game** (always visible section)
   - Search input (`Search games…`)
   - Hint line (contextual): select platform, type N more chars, match count, etc.
   - Results list (hidden until platform selected and user interacts)
   - Search requires **3+ characters** for filtered search; shorter input can still browse A–Z list

5. **Project actions** (bottom section)
   - **Export** — download `nfc-card-designer.json`
   - **Import** — load JSON backup
   - **Clear** — wipe settings + collection (with confirmation)

#### Center column — Preview (`panel--preview`)

Vertically top-aligned, content centered horizontally.

| Block | Contents |
|-------|----------|
| **Preview meta** | Status line (e.g. “Search for a game to preview artwork.”) |
| **Preview layout** | Flex row: main preview + artwork controls sidebar |
| **Preview main** | Artwork type tabs → card frame (life-size preview) → screen calibration slider → **Add to collection** (primary, disabled until a game is browsed) |
| **Artwork controls** | Per-preview overrides: alignment, zoom, rotation, background, reset to platform defaults; **Card customization** checkboxes (Show Header, Show Platform Accents) |

**Preview frame:** Renders card at physical dimensions (52 × 84 mm default) with optional calibration scale (70–130%). Shows loading skeleton while artwork fetches. Sticker inset visible as inner guide on card.

**Add flow:** User selects platform → searches/browses game → previews artwork type → adjusts if needed → **Add to collection**. Editing an existing collection card reopens browse mode for that card.

#### Right column — Collection (`panel--collection`)

| Block | Contents |
|-------|----------|
| **Header** | “Collection” title + selection meta (“No cards selected”, “N cards selected”) |
| **Selection actions** | Select All / Deselect All |
| **Bulk actions** | **Print PDF** (primary) / **Delete Selected** (danger) — disabled when nothing selected |
| **Collection list** | Grouped by platform (`<details>` per platform, open by default). Each card row: edit (✎), select toggle, label `Game Name - Artwork Type`, optional “placeholder” badge if image failed |

**Empty state:** “Search for a game and press Enter to add cards.”

**Print PDF:** Exports US Letter sheet, 3×3 cards per page, cut marks (see [Card layout](#card-layout-print)).

---

### Supplies — `supplies.html`

**Status:** Shipped  
**Nav:** Supplies shown as current page.

**Layout:** `.static-page` inside `.site-container` (centered, max content width).

**Sections:**

1. **Lead** — PDF is 9 labels per letter sheet; mentions writing tags with common NFC apps; Amazon search links are non-affiliate.
2. **Essentials** — NTAG215 blank cards; matte vinyl sticker paper (US Letter).
3. **Cutting & finishing** — R3 corner rounder; cutting mat / ruler / craft knife.
4. **3D-printed sticker applicator** — TapTo Sticker Applicator (Printables link, usage steps, CA glue).

**Footer:** “← Back to NFC Card Designer” link to home.

---

### Recognition — `recognition.html`

**Status:** Shipped  
**Nav:** Recognition shown as current page.

**Layout:** Same static page pattern as Supplies.

**Sections:**

1. **Lead** — Acknowledgment of bundled third-party assets.
2. **Platform logos** — Carbon EmulationStation theme (RetroPie), system SVG paths.
3. **Game artwork** — [libretro-thumbnails](https://github.com/libretro-thumbnails/libretro-thumbnails) on GitHub, loaded at runtime via `raw.githubusercontent.com` (same on every host — GitHub Pages, local dev, or custom domain).
4. **Fonts & UI** — Note that only platform SVGs are used from Carbon.

**Footer:** Back link to designer.

---

### Colors — `colors.html`

**Status:** Shipped (internal / unlisted)  
**Nav:** None — standalone page, no site header.

**Content:** Grid of color swatches — site accent (`--accent` CSS variable) plus each platform’s `defaultColor` from `platforms.js`. Read-only reference for design/debug.

---

### Developer — `developer.html`

**Status:** Shipped (internal / unlisted)  
**Nav:** Custom header — brand “NFC Card Designer”, **Developer** as current, plus Supplies + Recognition. Uses `.site-container` on header (slightly different from other pages).

**Sections:**

1. **Image load delay** — Artificial preview lag (0–10 000 ms) stored in `localStorage`; tests skeleton/loading UX.
2. **Local games with artwork** — Refreshable list from generated game catalog.
3. **Collection JSON** — Live readout of `localStorage` collection key (same data as Export).

**Footer:** Back to designer.

---

## Card layout (print)

**Status:** Shipped

Portrait default — **52 × 84 mm** card, **2 mm** sticker inset default.

```
┌──────────────────────────────┐
│  LOGO (75%)   │ COLOR (25%)  │  ← platform strip, top ~15% (default)
├──────────────────────────────┤
│                              │
│        ARTWORK (85%)         │
│                              │
└──────────────────────────────┘
```

- **Global:** Header height %, show/hide header, show/hide platform color strip.
- **Per platform:** Accent color, artwork priority, rotation, alignment, zoom, background.
- **Per card:** Overrides via preview artwork controls when browsing/editing.
- **PDF:** US Letter, 3 columns × 3 rows per page, 5 mm gap, cut marks outside card edges.

Landscape variant uses the same long-edge split rules (documented in `README.md`).

---

## Cross-cutting behavior

### Platform catalog

- **17 platforms** — Atari 2600 through PlayStation, plus DOS, Sega CD/32X, PC Engine CD, Neo Geo, Arcade.
- Platforms with **zero games in the catalog** are hidden from the platform list.

### Artwork & game catalog

- **Images:** `raw.githubusercontent.com/libretro-thumbnails/…` — loaded at runtime; not stored in this repo or on our deploy buckets.
- **Search index:** `game-catalog.json` (canonical names only), generated by `build-game-catalog.mjs` at deploy or locally — not committed to git.
- **Image types:** Box art (`Named_Boxarts`), title screen (`Named_Titles`), in-game (`Named_Snaps`).
- Global and per-platform priority order configurable.
- **Hosting is irrelevant to artwork** — GitHub Pages and local dev use the same GitHub raw URLs.

#### Two names per game (canonical vs friendly)

Every catalog entry and every saved collection card has **two related names**:

| Field | What it is | Used for |
|-------|------------|----------|
| **`libretroName`** | Exact libretro / GitHub filename stem (including region tags, catalog IDs, etc.) | Artwork URL lookup, PDF/canvas image resolution, persistence identity |
| **Friendly display name** (`Game.name` in search, `gameName` on cards) | Cleaned label derived from `libretroName` | Search results, collection list, preview chrome, card labels |

The friendly name is **display-only**. Filtering and cleanup never rewrite `libretroName`. The original GitHub name stays available as metadata so artwork keeps resolving even when display rules change.

On load and save, `gameName` is re-derived from `libretroName`, so older collections pick up newer friendly-name rules without breaking artwork.

#### Catalog build filters (`build-game-catalog`)

Pipeline per platform:

1. **Fetch** box-art (and related) filenames from the libretro-thumbnails GitHub tree. Large repos (Arcade) retry on transient `5xx`, then fall back to per-folder trees so catalogs stay complete.
2. **Retail gate** — drop non-retail / junk entries: RetroAchievements `~Hack~` / `~Homebrew~` / etc. markers, Beta/Proto/Demo/Sample, Bootleg, Homebrew, translation patches (`T-En`, `[English]`), SymbolicLink stubs, and `Named_*` path pollution.
3. **Regional / revision / disc dedupe** — keep **one** entry per base title:
   - Region priority: USA → World → USA/Europe combo → Europe → other countries → Japan/Asia
   - Japan-only (or any sole-region) games are kept when no higher-priority region exists
   - Among ties: most artwork (box + title + snap) wins, then lowest revision, then lowest disc number
   - Multi-disc releases collapse to a single entry (prefer Disc 1)
4. **Write** `libretroName` only into `game-catalog.json` (friendly names are computed at runtime).

#### Friendly display-name cleanup

At runtime, the friendly name is derived by:

1. Peeling trailing `(...)` and `[...]` metadata tags (regions, revisions, discs, publishers, years, serials, dump flags like `[!]`, Neo Geo `NGM`/`NGH` IDs, etc.)
2. Stripping trailing TOSEC-style version tokens (`v1.400`)
3. Normalizing alternate-title separators: spaced ` _ ` and MAME-style `_ ` (underscore + space) → ` - `; internal underscores like `Q_bert` or `1_2` are kept
4. **Keeping** parentheses that are part of the real title (e.g. `GS (Ghost Sweeper) Mikami`)

Example:

| `libretroName` (canonical) | Friendly display |
|----------------------------|------------------|
| `Andro Dunos (NGM-049)(NGH-049)` | `Andro Dunos` |
| `Aero Fighters 2 _ Sonic Wings 2` | `Aero Fighters 2 - Sonic Wings 2` |
| `1941_ Counter Attack (World)` | `1941 - Counter Attack` |
| `Doom (Europe)` | `Doom` |
| `Akumajou Dracula X - Gekka no Yasoukyoku v1.400 (1998)(Konami)(NTSC)(JP)[!]` | `Akumajou Dracula X - Gekka no Yasoukyoku` |

### Persistence

- `localStorage` keys: `nfc-card-designer-settings`, `nfc-card-designer-collection`.
- Export file: `nfc-card-designer.json` (project version 6).
- Collection cards store both `libretroName` (canonical artwork key) and `gameName` (friendly label derived on load/save).

---

## Shipped features (summary)

High-level checklist — detail lives in [Page specifications](#page-specifications-shipped) above.

- [x] Three-column designer: controls | preview | collection
- [x] Game search (3+ chars) scoped to selected platform
- [x] Artwork browse (box / title / in-game) with per-card overrides
- [x] Artwork from libretro-thumbnails GitHub raw URLs (CORS-safe for canvas/PDF)
- [x] Generated `game-catalog.json` for search (build-time; not in git)
- [x] Retail / regional catalog filters with friendly display names (canonical `libretroName` kept for artwork)
- [x] Collection grouped by platform; multi-select; PDF export
- [x] JSON export/import; localStorage persistence
- [x] Supplies and Recognition static pages in global nav
- [x] Unlisted Developer and Colors pages for maintainers
- [x] Deploy to GitHub Pages (static site only)
- [x] Dark-only `color-scheme` declared so mobile Safari/Chrome do not auto-darken the UI

---

## Related documents

| Document | Purpose |
|----------|---------|
| [GitHub Issues](https://github.com/TheRealBenForce/nfc-card-designer/issues) | Backlog, discussion, acceptance criteria |
| [`AGENTS.md`](../AGENTS.md) | Issue-driven workflow and agent instructions |
| [`README.md`](../README.md) | Quick start, card layout diagrams, deploy overview |
| [`docs/MAINTAINER.md`](./MAINTAINER.md) | Architecture, data pipelines, npm scripts |
| [`docs/decisions/`](./decisions/) | Permanent “why we chose X” records |

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-21 | Initial design document and page specifications |
| 2026-07-21 | GitHub raw artwork + generated catalog shipped |
| 2026-07-21 | Rebranded product as NFC Card Designer |
| 2026-07-22 | Catalog filters + friendly display names documented (`libretroName` remains canonical metadata) |
| 2026-07-22 | Declared dark-only `color-scheme` / `theme-color` to fix iPad Safari white outlines and off colors |
