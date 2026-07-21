# Zaparoo NFC Card Designer — Design Document

**Status:** Living document  
**Last updated:** 2026-07-21  
**Audience:** Product owner + AI assistant collaboration

This is the single source of truth for *what* we are building and *why*. Implementation details and maintainer runbooks live elsewhere (see [Related documents](#related-documents)).

---

## How to use this document (human + AI)

### Workflow

1. **Branch first** — Open a feature branch when you want to change direction or add scope. Commit edits to `docs/DESIGN.md` on that branch.
2. **Design before build** — Describe the idea here (or ask the AI to draft a section). Iterate until the **Acceptance criteria** and **Open questions** feel right.
3. **Explicit go-ahead** — The AI should **not** implement until you say something like *"go ahead and build it"* or mark the feature **Ready to build**.
4. **Diff-driven implementation** — On a branch with design changes, the AI compares this document to `main`, identifies affected features, and proposes or executes an implementation plan.

### Status labels

| Status | Meaning |
|--------|---------|
| **Shipped** | Live in the app today |
| **In design** | Being discussed; requirements may change |
| **Ready to build** | Requirements agreed; waiting for implementation go-ahead |
| **In progress** | Actively being implemented on a branch |
| **Deferred** | Agreed idea, not scheduled |
| **Rejected** | Considered and explicitly out of scope |

### Feature entry template

When adding a new idea, copy this block under [Backlog](#backlog):

```markdown
### <Feature name>

- **Status:** In design
- **Problem:** What pain does this solve?
- **Proposal:** What should happen, from the user's perspective?
- **Acceptance criteria:**
  - [ ] Observable outcome 1
  - [ ] Observable outcome 2
- **Out of scope:** What we are *not* doing in this iteration
- **Open questions:**
  - Question?
- **Notes:** Optional sketches, links, constraints
```

### AI assistant instructions

When working in this repository:

- **Read `docs/DESIGN.md` first** when the user mentions features, roadmap, or "the design doc."
- **Update this file** when the user describes new intent in conversation — draft or extend the relevant section, set status to **In design**, and ask clarifying questions before coding.
- **On a branch with design-doc changes**, summarize the delta vs `main` and list implementation tasks; wait for explicit approval unless the user already said to build.
- **Do not contradict Shipped behavior** unless this document is updated to change it.
- **Prefer small, verifiable acceptance criteria** over vague goals.

---

## Vision

Help retro-gaming collectors design and print **52 × 84 mm NFC card labels** for Zaparoo hardware — quickly, consistently, and without leaving the browser.

### Users

- **Primary:** Zaparoo owners printing sticker sheets at home on US letter paper.
- **Secondary:** Maintainers updating the bundled game-name catalog or platform list (infrequent).

### Goals

- Pick a game, choose artwork, preview a card, collect many cards, export a print-ready letter sheet.
- Stay **client-side only** — no accounts, no backend, persistence via `localStorage` and JSON export.
- Use **libretro thumbnail naming** as the canonical artwork scheme.

### Non-goals

- User accounts, cloud sync, or multi-device collaboration.
- Real-time NFC programming from the browser.
- Bundling game artwork PNGs in git.
- Hosting or syncing image files on AWS S3 (proposed removal — see [backlog](#github-pages--libretro-github-raw-urls-zero-image-hosting)).
- Exposing every libretro platform in the app (keep the current **17-platform** curated set).
- A build step or SPA framework for the main app.

---

## Design principles

1. **Print fidelity** — On-screen preview and PDF output should match physical card dimensions (52 × 84 mm default).
2. **Platform consistency** — Every card uses the same layout rules; platform identity comes from logo + color strip.
3. **Progressive disclosure** — Simple path: search → preview → add. Advanced controls (per-card artwork alignment, header overrides) stay available but tucked away.
4. **Offline-friendly state** — Collection and settings survive reloads; export/import provides a portable backup.
5. **Inventory-driven search** — Only games listed in the bundled game catalog appear in search (today: `image-manifest.json`; proposed: `game-catalog.json` — names only, no image paths).

---

## Site map & navigation

### Pages

| Page | File | In nav? | Purpose |
|------|------|---------|---------|
| **Designer** (home) | `index.html` | Brand link | Main card designer — search, preview, collection, PDF |
| **Supplies** | `supplies.html` | Yes | Shopping / materials guide for printing and NFC blanks |
| **Recognition** | `recognition.html` | Yes | Credits for artwork, logos, and data sources |
| **Thanks** | `thanks.html` | No | Post-support thank-you landing (linked externally) |
| **Colors** | `colors.html` | No | Internal palette reference (accent + platform default colors) |
| **Developer** | `developer.html` | No | Local dev tools (image delay, local artwork index, collection JSON) |

### Global header (site chrome)

Present on: **Designer**, **Supplies**, **Recognition**, **Thanks**, **Developer**.  
**Not present on:** `colors.html`.

| Element | Position | Behavior |
|---------|----------|----------|
| **Brand** | Left | `Zaparoo NFC Designer` → links to `./` (designer home) |
| **Supplies** | After brand | Link to `supplies.html`; shown as muted text (current page) on Supplies |
| **Recognition** | After Supplies | Link to `recognition.html`; shown as muted text on Recognition |

**Alignment:** Nav is a horizontal flex row, `align-items: baseline`, `gap: 1rem`, with `padding-left: 0.5rem`. Header has bottom border and surface background. Static content pages wrap body copy in `.site-container` (max-width, centered); the designer page header spans full width above the 3-column grid.

**Not in nav (by design today):** Developer, Colors, Thanks. Add nav links here only after updating this section and acceptance criteria.

---

## Page specifications (shipped)

### Designer — `index.html`

**Status:** Shipped  
**Title:** Zaparoo NFC Designer

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
   - Scrollable list of platforms with artwork in manifest
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

1. **Lead** — PDF is 9 labels per letter sheet; links to Zaparoo app for writing tags; Amazon search links are non-affiliate.
2. **Essentials** — NTAG215 blank cards; matte vinyl sticker paper (US Letter).
3. **Cutting & finishing** — R3 corner rounder; cutting mat / ruler / craft knife.
4. **3D-printed sticker applicator** — TapTo Sticker Applicator (Printables link, usage steps, CA glue).
5. **Official Zaparoo shop** — link to shop.zaparoo.com.

**Footer:** “← Back to Zaparoo NFC Designer” link to home.

---

### Recognition — `recognition.html`

**Status:** Shipped  
**Nav:** Recognition shown as current page.

**Layout:** Same static page pattern as Supplies.

**Sections:**

1. **Lead** — Acknowledgment of bundled third-party assets.
2. **Platform logos** — Carbon EmulationStation theme (RetroPie), system SVG paths.
3. **Game artwork** — [libretro-thumbnails](https://github.com/libretro-thumbnails/libretro-thumbnails) project on GitHub (proposed: loaded via `raw.githubusercontent.com`; shipped today: mirrored on S3).
4. **Fonts & UI** — Note that only platform SVGs are used from Carbon.

**Footer:** Back link to designer.

---

### Thanks — `thanks.html`

**Status:** Shipped  
**Nav:** Standard header (no page marked current).

**Content:** Thank-you message for project support; primary CTA “Back to designer”, secondary “View supplies”.

**Use:** Landing page after external support/donation flow (not linked from main nav).

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
2. **Local games with artwork** — Refreshable list from image manifest / local index.
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

## Cross-cutting behavior (shipped)

### Platform catalog

- **17 platforms** — Atari 2600 through PlayStation, plus DOS, Sega CD/32X, PC Engine CD, Neo Geo, Arcade.
- Platforms with **zero indexed artwork** are hidden from the platform list.

### Artwork pipeline *(shipped today)*

- Libretro-mirrored paths on S3; inventory in `image-manifest.json` (includes per-game image paths).
- **Image types:** Box art (`Named_Boxarts`), title screen (`Named_Titles`), in-game (`Named_Snaps`).
- Global and per-platform priority order configurable.

> **Proposed change:** See [GitHub Pages + libretro GitHub raw URLs](#github-pages--libretro-github-raw-urls-zero-image-hosting) in the backlog. Artwork URLs would be computed at runtime from libretro GitHub raw URLs; S3, sync scripts, and `image-manifest.json` would be removed.

### Persistence

- `localStorage` keys: `nfc-card-designer-settings`, `nfc-card-designer-collection`.
- Export file: `nfc-card-designer.json` (project version 6).

---

## Shipped features (summary)

High-level checklist — detail lives in [Page specifications](#page-specifications-shipped) above.

- [x] Three-column designer: controls | preview | collection
- [x] Game search (3+ chars) scoped to selected platform
- [x] Artwork browse (box / title / in-game) with per-card overrides
- [x] Collection grouped by platform; multi-select; PDF export
- [x] JSON export/import; localStorage persistence
- [x] Supplies and Recognition static pages in global nav
- [x] Unlisted Developer and Colors pages for maintainers

---

## Backlog

Features below are **not yet built** unless marked otherwise. Add new items at the top of this section.

### GitHub Pages + libretro GitHub raw URLs (zero image hosting)

- **Status:** In design — **awaiting product-owner review before implementation**
- **Problem:** Operating the app requires AWS (S3 + CloudFront), maintainer scripts (`fetch-images`, `sync-image-manifest`), CI manifest sync, and ongoing image mirroring. This is heavy for a static client-side tool whose artwork already exists in the public [libretro-thumbnails](https://github.com/libretro-thumbnails/libretro-thumbnails) organization on GitHub.
- **Proposal:** Host the static site on **GitHub Pages** and load game artwork directly from **GitHub raw URLs**. Remove all image storage, S3 deploy, and sync pipelines. Keep the existing **17 platforms** in `platforms.js`; do not expose libretro’s full platform list.
- **Acceptance criteria:**
  - [ ] Site deploys to GitHub Pages from `src/` on push to `main` (no AWS credentials in Pages CI).
  - [ ] Game search works for all **17 curated platforms** by fetching game names from the libretro-thumbnails GitHub API when the user selects a platform (no bundled `image-manifest.json` or `game-catalog.json`).
  - [ ] Card preview, collection thumbnails, and letter-sheet export render artwork from `https://raw.githubusercontent.com/libretro-thumbnails/<repo>/master/<Named_*>/<filename>.png`.
  - [ ] `imageAvailability` probes GitHub raw URLs to determine which artwork types exist for a game (box / title / in-game).
  - [ ] Letter-size print output still works at ~300 DPI with cut marks for selected collection cards.
  - [ ] Platforms that fail to load a game list show an error state and remain usable after retry; empty lists hide the platform (same as today).
  - [ ] Retail-title filtering is applied client-side after fetching filenames (same rules as `retailFilter.js` today).
  - [ ] Recognition page credits libretro-thumbnails on GitHub (not “hosted on S3”).
  - [ ] `npm run verify` passes without AWS credentials or local artwork mirrors.
  - [ ] README / `AGENTS.md` / `MAINTAINER.md` reflect the simplified architecture (implementation follow-up).
- **Out of scope:**
  - Adding libretro platforms beyond the current 17.
  - Bundling artwork PNGs or game-name catalogs in git.
  - Self-hosting a libretro mirror or CDN.
  - User accounts, server-side image proxy, or backend API.
  - Changing card layout, collection UX, or localStorage export format (except any version bump if required).
  - **AWS decommission** — keep existing S3/CloudFront deploy running; migrate DNS/hosting in a separate branch later.
  - Migrating custom domain DNS in this iteration.
- **Decisions (product owner, 2026-07-21):**
  - **Print format:** See [PDF vs PNG tradeoffs](#pdf-vs-png-tradeoffs) below — pick one at implementation time.
  - **Catalog build script / `game-catalog.json`:** **Not needed.** Fetch game names from GitHub when the user selects a platform; cache per session.
  - **AWS:** Do **not** decommission in this branch. GitHub Pages can be added alongside existing AWS hosting.
  - **Arcade size:** No special caps beyond existing search limits unless performance testing shows problems (see [Arcade / large catalogs](#arcade--large-catalogs-plain-language)).
- **Open questions:**
  - **PDF vs PNG** for letter-sheet export — awaiting final pick after reading tradeoffs below.
- **Notes:** Full implementation plan in [Proposed implementation plan](#proposed-implementation-plan) below.

#### Architecture decision: use GitHub raw URLs (not libretro CDN, not S3)

| Option | CORS for canvas/PDF? | Hosting burden | Verdict |
|--------|---------------------|----------------|---------|
| **S3 mirror (shipped)** | Yes (same-origin) | High — fetch, sync, deploy, AWS cost | Replace |
| **`thumbnails.libretro.com` CDN** | **No** — no `Access-Control-Allow-Origin` | None | Rejected for canvas-based print export |
| **`raw.githubusercontent.com` / libretro-thumbnails** | **Yes** — `Access-Control-Allow-Origin: *` | None for images | **Selected** |
| **Artwork in git / GitHub Pages** | Yes (same-origin) | Repo size (hundreds of GB) | Rejected |

**Rationale:** The app draws artwork onto `<canvas>` for preview blur, card composition, and letter-sheet export (`imageProvider.js` → `cardRenderer.js` → `pdfExport.js`). That requires CORS-permitted image loads (`crossOrigin = "anonymous"`). GitHub’s raw content host sends `Access-Control-Allow-Origin: *` on libretro-thumbnail PNGs; `thumbnails.libretro.com` does not.

**URL shape** (one repo per libretro system under [libretro-thumbnails](https://github.com/libretro-thumbnails)):

```
https://raw.githubusercontent.com/libretro-thumbnails/<libretroGitHubRepo>/master/<Named_Boxarts|Named_Titles|Named_Snaps>/<libretroName>.png
```

Example:

```
https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Nintendo_Entertainment_System/master/Named_Boxarts/Super%20Mario%20Bros.%20(USA).png
```

**Repo naming:** GitHub repos use underscores instead of spaces (`Nintendo - Nintendo Entertainment System` → `Nintendo_-_Nintendo_Entertainment_System`). Store `libretroGitHubRepo` internally in `platforms.js` — **never shown in the UI**. Users continue to see friendly names (`NES`, `Sega Genesis`) from the existing `name` field. Derive repo slugs from `libretroPlaylist` via a small helper (` - ` → `_-_`, spaces → `_`) with explicit overrides only where the formula fails validation.

**Platform scope:** Only the 17 platforms already defined in `platforms.js`. The libretro-thumbnails org has 100+ systems; none of the others are added to the app selector or catalog build.

**Planned `libretroGitHubRepo` values** (to add alongside existing `libretroPlaylist`):

| `platformId` | `libretroGitHubRepo` |
|--------------|----------------------|
| `atari-2600` | `Atari_-_2600` |
| `nes` | `Nintendo_-_Nintendo_Entertainment_System` |
| `master-system` | `Sega_-_Master_System_-_Mark_III` |
| `game-boy` | `Nintendo_-_Game_Boy` |
| `game-boy-color` | `Nintendo_-_Game_Boy_Color` |
| `snes` | `Nintendo_-_Super_Nintendo_Entertainment_System` |
| `genesis` | `Sega_-_Mega_Drive_-_Genesis` |
| `sega-cd` | `Sega_-_Mega-CD_-_Sega_CD` |
| `sega-32x` | `Sega_-_32X` |
| `turbo-grafx` | `NEC_-_PC_Engine_-_TurboGrafx_16` |
| `pc-engine-cd` | `NEC_-_PC_Engine_CD_-_TurboGrafx-CD` |
| `saturn` | `Sega_-_Saturn` |
| `n64` | `Nintendo_-_Nintendo_64` |
| `neo-geo` | `SNK_-_Neo_Geo` |
| `playstation` | `Sony_-_PlayStation` |
| `dos` | `DOS` |
| `arcade` | `FBNeo_-_Arcade_Games` |

Validate repo names against the live [libretro-thumbnails org](https://github.com/orgs/libretro-thumbnails/repositories) during implementation (one typo breaks an entire platform).

#### PDF vs PNG tradeoffs

Both use the same canvas render path today; only the final export step differs.

| | **PDF** (current) | **PNG** (single sheet image) |
|--|-------------------|------------------------------|
| **Print quality** | Excellent — embeds ~300 DPI raster cards; vector cut marks stay crisp | Excellent at 300 DPI — cut marks are raster too |
| **Multi-page decks** | Natural — one PDF, many letter pages | Awkward — multiple PNGs or one huge image |
| **User workflow** | Open PDF → print at 100% / “Actual size” | Open image → print at 100% / disable “fit to page” |
| **Inkjet sticker paper** | Works well | Works well; some drivers treat photos slightly differently |
| **Dependencies** | `jspdf` (already loaded from esm.sh) | None beyond canvas |
| **File size** | Moderate (compressed images per page) | Large for full letter at 300 DPI (~2550×3300 px) |
| **Simplicity** | Slightly more code (`pdfExport.js`) | Simpler — `canvas.toBlob()` download |

**Recommendation:** Keep **PDF** if multi-page printing matters (collections &gt; 9 cards). Switch to **PNG** only if you want fewer moving parts and rarely print more than one sheet. Offering both is low cost but adds UI clutter.

#### Arcade / large catalogs (plain language)

Libretro’s **Arcade** repo (and even **NES**) contains **thousands** of box-art filenames — including hacks, betas, and regional variants. The old open question was whether Arcade needs extra limits so search doesn’t feel overwhelming or slow.

With **runtime GitHub fetch**, the practical concerns are:

1. **Load time** — First time you pick a platform, the app downloads a list of filenames (one GitHub API call per platform, cached for the browser session). NES is ~13k names (~few MB JSON); Arcade is larger and may be slower or hit API size limits.
2. **Search noise** — Retail filter removes most junk, but Arcade still has more titles than a console. Existing **3+ character search** and **100-result cap** already keep the UI manageable.

No special Arcade-only rules are required unless testing shows problems; we can add a loading indicator and session cache first.

#### Proposed runtime architecture

```
src/index.html
  └── assets/js/main.js
        ├── gameCatalog.js       # on platform select → GitHub API → in-memory game list (session cache)
        ├── libretroThumbnails.js # GitHub raw URL builders + repo slug helper + filename helpers
        ├── imageProvider.js     # resolve GitHub raw URL for platform + libretroName + imageType
        ├── imageAvailability.js # probe which types exist on GitHub raw
        ├── cardRenderer.js      # canvas preview + print tiles (unchanged flow)
        └── pdfExport.js         # letter sheet + cut marks (or pngExport.js if PNG chosen)
```

**Game list (search index) — no bundled JSON:**

1. User selects a platform.
2. If not cached in memory / `sessionStorage`, call GitHub API:
   `GET /repos/libretro-thumbnails/{libretroGitHubRepo}/git/trees/master?recursive=1`
3. Extract `Named_Boxarts/*.png` paths → filename stems → apply `isRetailRelease()` → sort → store in memory.
4. Search/filter runs against that in-memory list (same UX as today).
5. Show a loading state during fetch; on failure, show retry (rate limit, network, oversized tree).

**Why not scrape HTML?** Use the **GitHub REST API**, not libretro directory HTML pages — more stable and structured.

**Why no `image-manifest.json`?** It existed to list games **and** S3 image paths. With GitHub raw URLs computed at runtime, we only need game **names** — and those can be fetched on demand per platform instead of shipping a static file or maintainer sync script.

**Image resolution flow:**

1. User picks a game (`libretroName` = exact boxart filename stem from the API listing).
2. `imageProvider.js` builds raw URLs per image type from `libretroGitHubRepo` + `LIBRETRO_IMAGE_FOLDERS`.
3. `imageAvailability.js` probes URLs (existing pattern); cache in memory.
4. Collection cards store `platformId`, `libretroName`, `imageType` — no stored image URLs.

**Hosting:** Add GitHub Pages deploy workflow for `src/`. **Keep** existing AWS workflow on `main` until a separate decommission branch (out of scope here).

#### Proposed implementation plan

*Do not implement until this section is approved.*

**1. Data & platform config**

| Action | Detail |
|--------|--------|
| Add repo slug helper | `libretroPlaylist` → `libretroGitHubRepo` (underscore rules + explicit overrides in `platforms.js` if needed) |
| Remove `image-manifest.json` | Replaced by runtime GitHub API fetch per platform |
| No `game-catalog.json` | Not used — names fetched on platform select |

**2. Browser modules**

| File | Change |
|------|--------|
| `libretroThumbnails.js` | Add `LIBRETRO_GITHUB_RAW_BASE`, `libretroGitHubRawUrl()`, `playlistToGitHubRepo()` |
| `gameCatalog.js` | Fetch game names from GitHub API on platform select; session cache; remove S3 manifest loading |
| `imageProvider.js` | Resolve GitHub raw URLs from platform + `libretroName` + `imageType` |
| `imageAvailability.js` | No structural change — probes new URLs |
| `ui.js` | Loading indicator while platform game list fetches |
| `developer.js` / `developer.html` | Show cached/API game counts per platform (not manifest file) |

**3. Remove (scripts, CI, infra, deps)**

| Remove | Reason |
|--------|--------|
| `scripts/fetch-images.mjs` | No local/S3 image upload |
| `scripts/sync-image-manifest.mjs` | No S3/local image inventory |
| `scripts/sync-s3-sample-images.mjs` | No S3 sample cache |
| `scripts/s3-storage.mjs` | No AWS SDK usage |
| `scripts/local-libretro-source.mjs` | No local libretro mirror |
| `scripts/deploy.mjs` | **Keep** — AWS site stays live until decommission branch |
| `infrastructure/`, `.env.example`, `@aws-sdk/client-s3` | **Keep** for now — removed in decommission branch |
| `npm run deploy` | **Keep** for AWS; remove `fetch-images`, `sync-image-manifest`, `sync-s3-sample-images` |
| `.github/workflows/deploy.yml` | Remove `sync-manifest` job dependency; deploy `src/` directly |
| `.github/workflows/sync-image-manifest.yml` | Remove — no manifest |
| Add `.github/workflows/pages.yml` | Deploy `src/` to GitHub Pages (alongside AWS) |

**4. Tests & verify**

| Action | Detail |
|--------|--------|
| Update / remove | `test-fetch-images-*`, `test-sync-image-manifest`, tests that assert S3/manifest paths |
| Add | Tests for `libretroGitHubRawUrl()`, `playlistToGitHubRepo()`, API response parsing |
| Update | Playwright smoke tests to tolerate network fetches to `raw.githubusercontent.com` (or mock) |
| `verify.mjs` | Drop AWS-dependent steps; keep syntax check + unit + UI smoke |

**5. Docs & static pages**

| File | Change |
|------|--------|
| `recognition.html` | Credit libretro-thumbnails GitHub; remove S3 hosting language |
| `README.md` | GitHub Pages deploy; remove artwork setup / AWS sections |
| `AGENTS.md` | Remove S3/sync gotchas; document game catalog + GitHub raw |
| `docs/MAINTAINER.md` | Rewrite for simplified architecture (or fold into DESIGN post-ship) |
| `supplies.html` | Minor copy if export button label changes (PDF → PNG) |

**6. Keep (unchanged or lightly touched)**

| Keep | Why |
|------|-----|
| `platforms.js` platform list (17 only) | Product scope |
| `fetch-platform-icons.mjs` | Platform SVGs still bundled in git |
| `src/assets/images/platforms/` | Local platform icons + favicon |
| `retailFilter.js` | Applied client-side after API fetch |
| Card layout, collection, localStorage, PDF/print layout math | Core product |
| `npm start`, `npm run verify` | Dev workflow |

#### Risks & mitigations

| Risk | Mitigation |
|------|------------|
| GitHub API rate limit (60 req/hr unauthenticated per IP) | One fetch per platform per session; cache in `sessionStorage`; show friendly message on 403 |
| Large tree response (NES ~13k boxarts) | Loading UI; parse once; retail filter reduces noise; search still capped at 100 results |
| Arcade tree may exceed API limits | Fall back to paginated Contents API on `Named_Boxarts/` if recursive tree fails |
| GitHub raw availability | Static URLs; probe cache in `imageAvailability` |
| `libretroName` must match filename exactly | Store exact stem from API listing; collection persists `libretroName` |
| Project Pages base path (`/repo-name/`) | Relative asset paths; audit absolute `/assets/…` links |

---

## Open questions (global)

- **PDF vs PNG** for letter-sheet export — see [tradeoffs](#pdf-vs-png-tradeoffs); product owner to confirm before build.

---

## Related documents

| Document | Purpose |
|----------|---------|
| [`AGENTS.md`](../AGENTS.md) | How AI assistants should run, test, and navigate this repo |
| [`README.md`](../README.md) | Quick start, card layout diagrams, deploy overview |
| [`docs/MAINTAINER.md`](./MAINTAINER.md) | Architecture, data pipelines, npm scripts, platform onboarding |
| `docs/adr/` *(optional, future)* | Architecture Decision Records — one file per significant technical choice |

### Document types (reference)

| Name | Typical filename | Use when |
|------|------------------|----------|
| **Design document** | `docs/DESIGN.md` | Living product spec — features, UX, acceptance criteria *(this file)* |
| **Agent instructions** | `AGENTS.md` | Tooling, test commands, repo conventions for AI |
| **README** | `README.md` | Onboarding humans; keep concise |
| **Maintainer / architecture notes** | `docs/MAINTAINER.md` | How the code and data pipelines work |
| **PRD** | `docs/PRD.md` | Optional formal product requirements for stakeholders |
| **Technical spec** | `docs/SPEC.md` | Optional deep implementation contract for large features |
| **ADR** | `docs/adr/0001-….md` | Record a single architectural decision and its rationale |

For this project, **`docs/DESIGN.md` + `AGENTS.md`** is the recommended pair: design intent here, execution rules in `AGENTS.md`.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-21 | Initial design document and AI collaboration workflow |
| 2026-07-21 | Added site map, navigation, and per-page layout specifications |
| 2026-07-21 | Backlog: GitHub Pages + libretro GitHub raw URLs — architecture decision, removal plan, implementation outline (awaiting review) |
| 2026-07-21 | Product review: runtime GitHub API game list (no catalog JSON), keep AWS deploy, clarify PDF/PNG and Arcade |
