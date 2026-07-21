# Implementation handoff: GitHub raw artwork + generated game catalog

**Audience:** Coding agent implementing the feature.  
**Spec:** [`docs/DESIGN.md`](./DESIGN.md) → backlog “GitHub Pages + libretro GitHub raw URLs”.  
**Status:** Ready to build. Follow this file in order. Do not invent scope.

---

## Locked decisions (do not reopen)

1. **Artwork** always from  
   `https://raw.githubusercontent.com/libretro-thumbnails/<repo>/master/<Named_Boxarts|Named_Titles|Named_Snaps>/<libretroName>.png`  
   Never from `thumbnails.libretro.com` (no CORS for canvas/PDF). Never mirror images to S3.
2. **Game search names** from generated `src/assets/data/game-catalog.json` (names only). **Not committed.** Built by `scripts/build-game-catalog.mjs` locally and in deploy CI.
3. **PDF** letter export stays (`pdfExport.js`). No PNG sheet export.
4. **S3+CloudFront** = static **site** hosting only (HTML/JS/CSS + generated catalog). Same image URLs as GitHub Pages / localhost.
5. **17 platforms only** — keep existing list in `platforms.js`. Do not add libretro’s full catalog.
6. **No** browser GitHub API for search. **No** background prefetch of game lists.

---

## Architecture after change

```
Browser:
  gameCatalog.js     → fetch assets/data/game-catalog.json (static, generated)
  imageProvider.js   → build raw.githubusercontent.com URLs
  imageAvailability  → probe those URLs (unchanged API)
  cardRenderer/pdf   → canvas + PDF (unchanged if imageProvider exports stay)

Build/CI:
  build-game-catalog.mjs → GitHub API → game-catalog.json (gitignored)
  deploy / pages workflows → build catalog, then publish src/
```

---

## Step 0 — Test fixture (do first)

`game-catalog.json` is gitignored, so tests need a committed sample:

1. Create `scripts/fixtures/game-catalog.sample.json` with a few entries for platforms already used in tests (`nes`, `sega-cd`, `sega-32x`, `dos`) — reuse names from current `image-manifest.json` (e.g. Super Mario Bros. (USA), Ecco the Dolphin (USA), Doom (…)).
2. Shape:

```json
{
  "version": 1,
  "generatedAt": "2026-07-21T00:00:00.000Z",
  "platforms": {
    "nes": [{ "libretroName": "Super Mario Bros. (USA)" }],
    "sega-cd": [{ "libretroName": "Ecco the Dolphin (USA)" }]
  }
}
```

3. In `scripts/verify.mjs`, before Playwright/UI tests: if `src/assets/data/game-catalog.json` is missing, copy the fixture there.
4. Deploy CI still runs the real `build-game-catalog` (not the tiny fixture).

---

## Step 1 — URL helpers

**Modify:** `src/assets/js/libretroThumbnails.js`

Add:

- `LIBRETRO_GITHUB_RAW_BASE = "https://raw.githubusercontent.com/libretro-thumbnails"`
- `playlistToGitHubRepo(libretroPlaylist)`  
  Rule: replace `" - "` → `"_-_"`, then remaining spaces → `"_"`.  
  Example: `"Nintendo - Nintendo Entertainment System"` → `"Nintendo_-_Nintendo_Entertainment_System"`.
- `libretroGitHubRawUrl(githubRepo, imageFolder, filename)`  
  Sanitize stem with existing `sanitizeLibretroFilename`, encode path segments, append `.png`.

Keep `LIBRETRO_IMAGE_FOLDERS` (`boxArt`→`Named_Boxarts`, etc.).

**Do not** wire `imageProvider` to `LIBRETRO_THUMBNAIL_BASE` / `thumbnails.libretro.com`.

**Tests:** Update `scripts/test-libretro-thumbnails.mjs` for the new helpers; remove live CDN network tests.

---

## Step 2 — Platforms

**File:** `src/assets/js/data/platforms.js`

Prefer deriving repo slug with `playlistToGitHubRepo(platform.libretroPlaylist)`.  
Optional: add explicit `libretroGitHubRepo` only if a slug is wrong.

Expected slugs:

| platformId | libretroGitHubRepo |
|------------|--------------------|
| atari-2600 | Atari_-_2600 |
| nes | Nintendo_-_Nintendo_Entertainment_System |
| master-system | Sega_-_Master_System_-_Mark_III |
| game-boy | Nintendo_-_Game_Boy |
| game-boy-color | Nintendo_-_Game_Boy_Color |
| snes | Nintendo_-_Super_Nintendo_Entertainment_System |
| genesis | Sega_-_Mega_Drive_-_Genesis |
| sega-cd | Sega_-_Mega-CD_-_Sega_CD |
| sega-32x | Sega_-_32X |
| turbo-grafx | NEC_-_PC_Engine_-_TurboGrafx_16 |
| pc-engine-cd | NEC_-_PC_Engine_CD_-_TurboGrafx-CD |
| saturn | Sega_-_Saturn |
| n64 | Nintendo_-_Nintendo_64 |
| neo-geo | SNK_-_Neo_Geo |
| playstation | Sony_-_PlayStation |
| dos | DOS |
| arcade | FBNeo_-_Arcade_Games |

Never show underscore slugs in the UI — keep `name` fields.

---

## Step 3 — `imageProvider.js` (critical)

**Modify:** `src/assets/js/imageProvider.js`

Today: reads `game.images[imageType]` relative paths.

Change:

1. Import `platformById`, `LIBRETRO_IMAGE_FOLDERS`, `libretroGitHubRawUrl`, `playlistToGitHubRepo`.
2. `getGameImagePath(game, imageType)` builds GitHub raw URL from `game.platformId` + `game.libretroName` + type. Return `null` if inputs missing.
3. `candidateImagePaths(card, game, imageType)` returns that URL (fall back to card’s `platformId`/`libretroName` if needed).
4. Keep `loadImage` with `crossOrigin = "anonymous"` (required for PDF).
5. Keep export names: `getGameImagePath`, `candidateImagePaths`, `resolveGameImage`, `resolveCardImage`, `loadImage`.

`imageAvailability.js`, `cardRenderer.js`, `pdfExport.js` should need no structural changes.

---

## Step 4 — `gameCatalog.js`

**Modify:** `src/assets/js/gameCatalog.js`

1. Load `"assets/data/game-catalog.json"` only.
2. **Delete** `S3_MANIFEST_URL`, timeout, `shouldUseRemoteManifestFirst()`, and remote-first fetch.
3. Map entries `{ libretroName }` → `{ platformId, libretroName, name: libretroName }` — no `images` object.
4. Drop `gameHasImage` path filtering; keep entries with non-empty `libretroName`.
5. Keep public APIs: `loadGameCatalog`, `searchGames`, `platformsWithArtwork`, `gameForCard`, etc.

---

## Step 5 — Create catalog builder

**Create:** `scripts/build-game-catalog.mjs`  
**npm:** `"build-game-catalog": "node scripts/build-game-catalog.mjs"`

Behavior:

1. Load all platforms from `platforms.js`.
2. For each platform, GitHub API:  
   `GET /repos/libretro-thumbnails/{repo}/git/trees/master?recursive=1`  
   Headers: `User-Agent: nfc-card-designer`, `Accept: application/vnd.github+json`, and `Authorization: Bearer ${GITHUB_TOKEN}` when set.
3. Collect `Named_Boxarts/*.png` → filename stems → `isRetailRelease()` → sort.
4. If tree truncated/fails (Arcade): paginate Contents API on `Named_Boxarts/`.
5. Write `src/assets/data/game-catalog.json`:

```json
{
  "version": 1,
  "generatedAt": "<ISO>",
  "platforms": {
    "nes": [{ "libretroName": "Super Mario Bros. (USA)" }]
  }
}
```

6. Log per-platform counts; non-zero exit on total failure.

Optional: document `npm run build-game-catalog` before `npm start`. Avoid mandatory `prestart` if it would break offline start — README is enough unless you want `prestart`.

---

## Step 6 — Delete legacy image pipeline

**Delete:**

- `src/assets/data/image-manifest.json`
- `scripts/fetch-images.mjs`
- `scripts/sync-image-manifest.mjs`
- `scripts/image-manifest.mjs`
- `scripts/libretro-image-paths.mjs`
- `scripts/sync-s3-sample-images.mjs`
- `scripts/s3-storage.mjs`
- `scripts/local-libretro-source.mjs`
- `scripts/libretro-thumbnails.mjs` (Node script — **not** `src/assets/js/libretroThumbnails.js`)
- `scripts/load-env.mjs` (if unused after deletes)
- `.github/workflows/sync-image-manifest.yml`
- `scripts/test-fetch-images-skip.mjs`
- `scripts/test-fetch-images-limit.mjs`
- `scripts/test-fetch-images-local-libretro.mjs`
- `scripts/test-sync-image-paths.mjs`

**Keep:** `scripts/deploy.mjs`, `infrastructure/`, `fetch-platform-icons.mjs`, `src/assets/images/platforms/`, favicon, `game-filters.mjs`, `retailFilter.js`.

**`package.json`:** Remove `fetch-images`, `sync-image-manifest`, `sync-s3-sample-images` and related `test:*`. Add `build-game-catalog`. Remove `@aws-sdk/client-s3` (deploy uses AWS CLI).

---

## Step 7 — CI / deploy / gitignore

### `.github/workflows/deploy.yml`

- Remove `sync-manifest` job + artifact download.
- One job: checkout → `npm ci` → `npm run build-game-catalog` with `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` → AWS creds → `node scripts/deploy.mjs` → CloudFront invalidate.

### Create `.github/workflows/pages.yml`

- Push to `main` + `workflow_dispatch`.
- checkout → `npm ci` → `build-game-catalog` with `GITHUB_TOKEN`.
- Deploy `src/` to GitHub Pages (upload-pages-artifact + deploy-pages).
- Document enabling Pages (GitHub Actions source) in README.

### `scripts/deploy.mjs`

- Keep site sync + extensionless routes.
- Simplify/remove excludes that only protected `Named_*` game art on S3.

### `.gitignore`

Add:

```
src/assets/data/game-catalog.json
```

### `.env.example`

Keep AWS vars for **site** deploy only. Remove image-upload / fetch-images wording.

---

## Step 8 — Tests + verify

| File | Action |
|------|--------|
| `test-game-catalog.mjs` | Assert names-only shape; no required `images` paths |
| `test-image-lookup.mjs` | Assert GitHub raw URL from `getGameImagePath` / `candidateImagePaths` |
| `test-platform-visibility.mjs` | Use game-catalog (or fixture) |
| `test-libretro-thumbnails.mjs` | Unit-test new helpers; no live CDN |
| `test-game-search.mjs` | Ensure catalog file exists (fixture copy) |
| `verify.mjs` | Drop deleted tests; copy fixture → catalog if missing before UI tests |

Add `scripts/test-build-game-catalog.mjs` for parsing/filtering helpers with mocked tree JSON (no live API required).

---

## Step 9 — Docs / HTML copy

| File | Change |
|------|--------|
| `src/recognition.html` | Credit libretro-thumbnails on GitHub — **no “hosted on S3”** |
| `src/developer.html` / `developer.js` | Catalog wording; remove fetch-images / image-manifest copy |
| `src/assets/js/ui.js` | Empty hint → run `npm run build-game-catalog` |
| `src/developer.html` | Prefer relative `assets/...` (fix absolute `/assets/...`) |
| `AGENTS.md` | Catalog build + GitHub raw; S3 = site only |
| `README.md` | Same; delete libretro→S3 artwork section |
| `docs/MAINTAINER.md` | Rewrite for new pipeline |
| `infrastructure/README.md` | Static site only |
| `docs/DESIGN.md` | After ship: mark feature **Shipped**, tick acceptance criteria |
| `supplies.html` | Leave PDF wording (PDF kept) |

---

## Step 10 — Done checklist

- [ ] `game-catalog.json` not in git; listed in `.gitignore`
- [ ] `npm run build-game-catalog` produces catalog for all 17 platforms
- [ ] After catalog build, `npm start`: search works; images load from `raw.githubusercontent.com`
- [ ] Print PDF works (canvas not tainted)
- [ ] `npm run verify` passes without image-hosting AWS usage
- [ ] Deploy workflow builds catalog then publishes site only
- [ ] No remaining references to `image-manifest.json`, `fetch-images`, or S3 artwork hosting
- [ ] Still exactly 17 platforms

---

## Do not touch

- Card layout / collection UX / localStorage schema (unless forced)
- Expanding platforms beyond 17
- PDF → PNG
- Deleting AWS site deploy / `infrastructure/`
- Bundling PNGs in git
- Runtime GitHub API in the browser for game lists

---

## Suggested coding order

1. Step 1 helpers + tests  
2. Steps 3–4 + fixture (Step 0)  
3. Step 5 builder  
4. Step 6 deletes + package.json  
5. Step 7 CI  
6. Step 8 verify green  
7. Step 9 docs  
8. Step 10 smoke  

---

## Quick file checklist

### CREATE
- `scripts/build-game-catalog.mjs`
- `scripts/fixtures/game-catalog.sample.json`
- `.github/workflows/pages.yml`
- `scripts/test-build-game-catalog.mjs` (recommended)

### MODIFY
- `src/assets/js/libretroThumbnails.js`
- `src/assets/js/imageProvider.js`
- `src/assets/js/gameCatalog.js`
- `src/assets/js/developer.js`, `ui.js`
- `src/assets/js/data/platforms.js` (only if adding explicit repo fields)
- `src/recognition.html`, `src/developer.html`
- `scripts/deploy.mjs`, `scripts/verify.mjs`
- `.github/workflows/deploy.yml`
- `package.json`, `.gitignore`, `.env.example`
- `AGENTS.md`, `README.md`, `docs/MAINTAINER.md`, `infrastructure/README.md`
- Tests listed in Step 8

### DELETE
- All legacy files listed in Step 6

### KEEP UNCHANGED (behavior)
- `pdfExport.js`, `pdfLayout.js`, `cardRenderer.js` (aside from URL source via imageProvider)
- `imageAvailability.js` API
- Platform icons + favicon
