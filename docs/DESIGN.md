# NFC Card Designer — Design Document

**Status:** Living document (current product state)  
**Last updated:** 2026-07-24  
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
| **Designer** (home) | `index.html` | Brand link | Main card designer — Select, Edit, Print |
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

**Alignment:** Nav is a horizontal flex row, `align-items: baseline`, `gap: 1rem`, with `padding-left: 0.5rem`. Header has bottom border and surface background. Static content pages wrap body copy in `.site-container` (max-width, centered); the designer page header spans full width above the Select · Edit · Print grid.

**Not in nav (by design today):** Developer, Colors. Add nav links here only after updating this section and acceptance criteria.

---

## Page specifications (shipped)

### Designer — `index.html`

**Status:** Shipped  
**Title:** NFC Card Designer

#### Overall layout

Three named columns in a CSS grid (`.app`), left → center → right: **Select** · **Edit** · **Print**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER: Brand | Supplies | Recognition                                  │
├──────────────┬────────────────────────────────────┬───────────────────────┤
│    SELECT    │              EDIT                  │        PRINT          │
│  (centered   │  (centered title; OFF until a      │  (centered title)     │
│   title)     │   game is loaded — see below)      │                       │
│  260–320px   │  flex / 1fr                        │  220–280px            │
└──────────────┴────────────────────────────────────┴───────────────────────┘
```

Each column opens with a **centered, pronounced section title** (`Select`, `Edit`, or `Print`) — larger type, semibold, full panel width, text-align center. Subsection labels inside a column (e.g. “Platform”, “Game”) stay left-aligned as today.

- **Desktop (wide):** `grid-template-columns: minmax(260px, 320px) 1fr minmax(220px, 280px)`; full viewport height minus header.
- **Narrow viewports:** Collapses to **one column, three rows** — Select → Edit → Print (top to bottom). There is **no** intermediate layout with two sections on one row and the third on another row.
- Panels are separated by vertical borders on desktop; horizontal borders when stacked. The Print panel has no right border on desktop.

#### User flow

```
  SELECT                    EDIT                      PRINT
  ──────                    ────                      ─────
  pick platform + game  →   customize card       →    saved card list
  or copy from list         Add to collection          select · Print PDF
                                                      copy-in only (no edit)
         ↑______________________________________________|
                    copy from Print reloads Edit
```

#### Select (`panel--select`, left column)

**Purpose:** Choose what to work on — a catalog game or settings copied from an existing collection card.

Top to bottom:

1. **Global Settings** (collapsible `<details>`, collapsed by default)
   - Card Width (mm) — default 52
   - Card Height (mm) — default 84
   - Sticker Inset (mm) — default 2
   - Platform Icons theme (unchanged)

2. **Platform** (subsection)
   - Scrollable list of platforms with games in the catalog
   - Selecting a platform filters game search to that platform
   - **No per-platform edit affordance** — platform defaults are edited from the **Edit** column (see [Platform defaults](#platform-defaults))

3. **Game** (subsection)
   - Search input (`Search games…`)
   - Hint line (contextual): select platform, type N more chars, match count, etc.
   - Results list (hidden until platform selected and user interacts)
   - Search requires **3+ characters** for filtered search; shorter input can still browse A–Z list

4. **Project actions** (bottom)
   - **Export** — download `nfc-card-designer.json`
   - **Import** — load JSON backup
   - **Clear** — wipe settings + collection (with confirmation)

**Always interactive** — Select is never gated.

#### Edit (`panel--edit`, center column)

**Purpose:** Preview and customize the card currently loaded in the editor.

The **entire Edit column is OFF** until a game is loaded. Loading happens only when the user:

1. **Selects a game** from search results in Select, **or**
2. **Copies** a saved card’s settings from the Print list (copy-in)

There is **no** edit-in-place from the Print list — no ✎ button, no “Update Card”, no `targetCardId` flow. Copy-in always starts a **new** add session (button reads **Add to collection**).

**OFF (no active session):**

```
┌─────────────────────────────────────┐
│              EDIT                   │  ← centered title (always visible)
├─────────────────────────────────────┤
│                                     │
│         ┌─────────────┐             │
│         │  ░ skeleton │             │  ← idle preview-skeleton (continuous)
│         └─────────────┘             │
│                                     │
│   (controls hidden or inert)        │  ← full column gated, not per-control
│                                     │
└─────────────────────────────────────┘
```

- Preview meta e.g. “Select a game to start editing.”
- Card frame shows the existing `.preview-skeleton` sticker continuously.
- Image-type tabs, artwork controls, calibration, and **Add to collection** are not available (hidden or non-interactive as one unit).
- Panel exposes `aria-disabled="true"` (or equivalent) while OFF.

**ON (game loaded via Select or copy-in):**

| Block | Contents |
|-------|----------|
| **Preview meta** | Status while loading / previewing |
| **Preview layout** | Flex row: main preview + artwork controls sidebar |
| **Preview main** | Image-type tabs → card frame → screen calibration slider → **Add to collection** (primary) |
| **Artwork controls** | Accent color; alignment grid, zoom, rotation, background mode/color; **Header design** checkboxes (Show Header, Show Platform Accents) and header-height control; **Reset card** and **Save to platform defaults** buttons (see below) |

**Sticker / skeleton while ON:**

```
  Loading artwork     Ready
  ───────────────     ─────
  preview-skeleton    live card preview
  (existing 120 ms    (52 × 84 mm default,
   delay + pulse)      calibration 70–130%)
```

- **Loading:** Same `.preview-skeleton` element and animation as today while artwork fetches.
- **Ready:** Live card preview; sticker inset visible as inner guide on card.

**Add flow:** Select platform → search game → customize in Edit → **Add to collection** → card appears in Print. Copy-in from Print loads settings into Edit for a **new** card; it does not modify the source row.

**Layout:** Card preview horizontally centered within Edit. Artwork controls in the right sidebar of the Edit column.

**Platform-default actions** (bottom of artwork controls sidebar, below header design):

| Control | Behavior |
|---------|----------|
| **Reset card** | Reverts the card currently in the editor to the **saved platform defaults** for its platform. Disabled whenever the editor already matches those defaults (including on first load with no edits). Replaces the former “Reset to Platform Defaults” and “Reset to system defaults” controls — there is no separate in-app factory-reset for a single platform (full project **Clear** still resets everything). |
| **Save to platform defaults** | Opens a confirmation modal. On confirm, writes the current editor settings into `settings.platformDefaults` for the active platform and bulk-updates every **default** collection card on that platform (see [Card customization state](#card-customization-state)). Customized cards are untouched. |

**Save to platform defaults — confirmation modal copy:**

> This will overwrite **{Platform name}** defaults and update **N** default card(s) in your collection. Customized cards will not change.

Buttons: **Cancel** / **Save** (primary).

**What “Save” captures** (full platform template from Edit):

- Accent color
- Artwork display (alignment, zoom, background mode/color)
- Per-image-type rotation for the **currently selected artwork tab** (other types keep their existing platform-default rotations)
- Header design (show header, show platform accents, header height %)

Artwork **priority order** (box / title / in-game) remains seeded from bundled system defaults unless changed in a future control; it is not part of this save action.

**Customization detection:** Any change to the fields above (or switching artwork type / rotation away from platform defaults) marks the session as customized relative to platform defaults. **Reset card** clears that and returns to platform defaults.

#### Print (`panel--print`, right column)

**Purpose:** Manage the saved card list and export a print-ready PDF.

There is **no separate “Collection” heading** — the **Print** section title is the only panel header. The collection is organized by platform; individual cards are browsed in an overlay carousel, not inline in the column.

| Block | Contents |
|-------|----------|
| **Selection meta** | “No cards selected” / “N cards selected” — **global total only** (not per platform) |
| **Selection actions** | Select All / Deselect All |
| **Bulk actions** | **Print PDF** (primary) / **Delete Selected** (danger) — disabled when nothing selected |
| **Platform list** | Flat, scrollable list of platforms that have at least one saved card. Each row: platform icon, name, **selection badge** — `4 of 12 selected` when any cards on that platform are selected, otherwise `12` (total only). Rows are buttons — not collapsible. No inline card rows. |

**Empty state:** “Add a game from Select to build your print sheet.”

**Print PDF:** Exports US Letter sheet, 3×3 cards per page, cut marks (see [Card layout](#card-layout-print)).

##### Platform card browser (screen overlay)

Selecting a platform row opens a **viewport-level card browser** — not a panel inside the Print column. The browser **slides in from the edge of the screen**; everything behind it (site header, Select, Edit, Print, and the full page) is **dimmed and blurred**.

```
  Narrow (≤1100px)                    Wide (≥1101px)
  ────────────────                    ──────────────
  (dock rises from bottom)            (sidebar slides from right)

  ┌─────────────────────┐             ┌──────────────────┬────────┐
  │░░░░ BLURRED PAGE ░░░│             │░░░ BLURRED PAGE ░│SIDEBAR │
  │░░ header + app ░░░░░│             │░░ header + app ░│↑ card ↓│
  │░░░░░░░░░░░░░░░░░░░░░│             │░░░░░░░░░░░░░░░░░│ scroll │
  ├─────────────────────┤             │░░░░░░░░░░░░░░░░░│ snap   │
  │← [card] [card] [card]│             └──────────────────┴────────┘
  │     BOTTOM DOCK      │
  │   horizontal snap    │
  └─────────────────────┘
```

| Concern | Behavior |
|---------|----------|
| **Mount point** | `position: fixed` on the **viewport** (`inset: 0` backdrop + edge-anchored sheet). Not nested inside `.panel--print` or the designer grid. |
| **Enter animation** | **Sidebar:** slides in from the **right screen edge** (`translateX`). **Dock:** slides up from the **bottom screen edge** (`translateY`). Respect `prefers-reduced-motion` (fade or instant). |
| **Layout** | **Sidebar** — flush to the right edge of the screen, ~min(22rem, 90vw) wide, full viewport height. **Dock** — flush to the bottom edge of the screen, ~min(22rem, 55dvh) tall, full viewport width. |
| **Backdrop** | Full-screen layer behind the sheet: semi-transparent dim + `backdrop-filter: blur(...)` over **the entire page** (header, all three designer columns, and any scrollable content). The Print toolbar and selection meta are behind the blur like everything else — not kept sharp. |
| **Z-index** | Above site header and all panels; below any future global toasts if added later. |
| **Open** | Click/tap a platform row in the Print list. Only one browser open at a time; opening another platform switches content. |
| **Dismiss** | Click/tap the blurred backdrop, **Escape**, or explicit **Close** control in the browser chrome. Sheet slides back off-screen; backdrop fades out. Returns focus to the platform row that opened the browser. |
| **Focus** | Focus trap inside the browser while open; `aria-modal="true"`. |
| **Header** | Platform icon + name; subtitle `M of N` (position in that platform’s carousel). Close button. |
| **Carousel** | **Scroll-snap strip with peeking neighbors** — the focused card is centered (or primary); adjacent cards peek at the edges. **Sidebar (wide):** vertical scroll (up/down); wheel, touch drag, and prev/next step the snap points. **Dock (narrow):** horizontal scroll (left/right); swipe, drag, and prev/next step the snap points. Keyboard: **Up/Down** in sidebar, **Left/Right** in dock; **Space** toggles selection on the snapped card. |
| **Card chrome** | Larger card preview (thumbnail or mini card frame), game name, artwork type label, **default vs customized** indicator (see [Card customization state](#card-customization-state)), optional “placeholder” badge if image failed. |
| **Per-card actions** | **Select** toggle (`aria-pressed`) — same selection state as today. **Copy-in** — loads settings into Edit for a new add (unchanged semantics). No edit-in-place (✎). |
| **Live updates** | Toggling selection updates the global selection meta and the platform row badge immediately (visible after dismiss for the meta; badge updates in the list). Adding/removing cards while the browser is open refreshes the carousel; if the platform becomes empty, dismiss automatically. |
| **Platform row badge** | When **zero** cards on that platform are selected: show total only (`12`). When **one or more** are selected: `4 of 12 selected`. Badge styling may emphasize the selected state (e.g. accent tint) when the ratio is non-zero. |

**Ship as full replacement** — removes the current collapsible per-platform `<details>` card lists; no feature flag.

**Responsive note:** Uses the same **1100px** breakpoint as the designer grid (three columns vs stacked rows). Sidebar vs dock follows **viewport width**, not which column Print happens to sit in when stacked.

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
2. **Platform logos** — Carbon EmulationStation theme (RetroPie) SVGs on card headers; RetroArch XMB themes in the platform selector (Global Settings → Platform Icons).
3. **Game artwork** — [libretro-thumbnails](https://github.com/libretro-thumbnails/libretro-thumbnails) on GitHub, loaded at runtime via `raw.githubusercontent.com` (same on every host — GitHub Pages, local dev, or custom domain).
4. **3D-printed sticker applicator** — Credits [EntirelyTom](https://www.printables.com/@EntirelyTom) (TapTo Sticker Applicator on Printables); cross-link to Supplies.
5. **Inspiration** — Project influenced by [Wizzo](https://zaparoo.org) / TapTo (Zaparoo) and the MiSTeR FPGA community.
6. **Fonts & UI** — Note that only platform SVGs are used from Carbon.

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

- **Global (layout only):** Card width/height, sticker inset.
- **Per platform:** Accent color, artwork priority (system-seeded), per-type rotation, alignment, zoom, background, header design (show header, show platform strip, header height %). Stored in `settings.platformDefaults`.
- **Per card:** `default` cards inherit live platform defaults; `customized` cards store explicit overrides.
- **PDF:** US Letter, 3 columns × 3 rows per page, 5 mm gap. Crop marks align to every sticker edge (imaginary trim lines through bleed), but are drawn only in page margins and card gutters — never through sticker artwork or bleed. Exported artwork bleeds to the full card slot using nearest-edge color extension.

### Platform defaults

Three layers:

```
System defaults (bundled platform-defaults.json)
       ↓ seeds first run / project Clear
User platform defaults (settings.platformDefaults, per platform)
       ↓ inherited by default cards
Collection cards (customization: default | customized)
```

| Layer | Source | User can change via |
|-------|--------|---------------------|
| **System defaults** | `assets/data/platform-defaults.json` | **Clear** project only (resets all settings) |
| **Platform defaults** | `localStorage` / export JSON | **Save to platform defaults** in Edit |
| **Card** | Collection entry | Edit controls; **Reset card** returns to platform defaults |

**Removed UI:** Platform Settings modal and the ✎ edit icon on platform rows in Select. All platform-template editing flows through Edit.

### Card customization state

Every collection card carries:

```text
customization: "default" | "customized"
```

| State | Meaning | When platform defaults change |
|-------|---------|-------------------------------|
| **default** | Card follows the saved platform template | Overrides cleared; card re-renders from updated platform defaults |
| **customized** | User diverged from platform defaults | Unchanged |

**Transitions to `customized`:** any edit in the editor that differs from platform defaults before **Add to collection**; copy-in from a customized card.

**Transitions to `default`:** add with no edits; **Reset card** then add; card is the source of **Save to platform defaults**; migration infers `default` when no overrides exist.

**Carousel indicator** (Print overlay, #88): compact dot on the card thumbnail — outline = default, filled = customized. Tooltip: “Uses platform defaults” / “Customized — won’t change when defaults update”.

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
- Export file: `nfc-card-designer.json` (project version **7** — adds `customization` on cards and `headerSettings` on platform defaults).
- Collection cards store `libretroName` (canonical artwork key), `gameName` (friendly label), and `customization` (`default` | `customized`).
- `platformDefaults` entries include `headerSettings` (show header, show platform strip, header height %).
- **Migration (v6 → v7):** cards without `customization` infer `default` when they have no artwork/header overrides vs their platform defaults; otherwise `customized`. Global header fields in settings migrate into each platform’s `headerSettings` where missing.

---

## Shipped features (summary)

High-level checklist — detail lives in [Page specifications](#page-specifications-shipped) above.

- [x] Three-column designer: Select | Edit | Print (centered section titles); narrow viewports stack to 1×3 rows only
- [x] Edit column OFF until a game is selected or copied from Print; idle skeleton on card frame
- [x] Print column holds saved card list; copy-in only (no in-place edit / Update Card)
- [x] Game search (3+ chars) scoped to selected platform
- [x] Artwork browse (box / title / in-game) with per-card overrides
- [x] Artwork from libretro-thumbnails GitHub raw URLs (CORS-safe for canvas/PDF)
- [x] Generated `game-catalog.json` for search (build-time; not in git)
- [x] Retail / regional catalog filters with friendly display names (canonical `libretroName` kept for artwork)
- [x] Collection grouped by platform in Print; cards browsed via platform overlay carousel; multi-select; PDF export
- [x] JSON export/import; localStorage persistence
- [x] Supplies and Recognition static pages in global nav
- [x] Unlisted Developer and Colors pages for maintainers
- [x] Deploy to GitHub Pages (static site only)
- [x] Platform defaults edited from Edit (Save / Reset card); no platform-row edit modal
- [x] Card `customization` state (`default` | `customized`) with carousel indicator
- [x] Header design per platform (moved out of global settings)

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
| 2026-07-22 | Designer reframed as Select · Edit · Print; full Edit column gating; copy-in only from Print |
| 2026-07-22 | ADR 0003 accepted; Designer status Approved — pending implementation |
| 2026-07-23 | Print collection UX: platform list + viewport-edge scroll-snap browser (#88); ADR 0004 |
| 2026-07-24 | Platform defaults redesign: Edit-centric Save/Reset card, card default/customized state, remove platform modal |
