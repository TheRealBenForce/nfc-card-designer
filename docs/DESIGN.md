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
- **Secondary:** Maintainers curating libretro artwork inventory on S3.

### Goals

- Pick a game, choose artwork, preview a card, collect many cards, export a print-ready PDF.
- Stay **client-side only** — no accounts, no backend, persistence via `localStorage` and JSON export.
- Use **libretro thumbnail paths** as the canonical artwork naming scheme.

### Non-goals

- User accounts, cloud sync, or multi-device collaboration.
- Real-time NFC programming from the browser.
- Bundling full game artwork in git (images live on S3).
- A build step or SPA framework for the main app.

---

## Design principles

1. **Print fidelity** — On-screen preview and PDF output should match physical card dimensions (52 × 84 mm default).
2. **Platform consistency** — Every card uses the same layout rules; platform identity comes from logo + color strip.
3. **Progressive disclosure** — Simple path: search → preview → add. Advanced controls (per-card artwork alignment, header overrides) stay available but tucked away.
4. **Offline-friendly state** — Collection and settings survive reloads; export/import provides a portable backup.
5. **Inventory-driven search** — Only games with artwork in `image-manifest.json` appear in search.

---

## Shipped features

### Card designer (main app)

- **Status:** Shipped
- **Summary:** Single-page designer at `index.html` for building a card collection.
- **User flow:**
  1. Select platform (or search across platforms).
  2. Type 3+ letters to search games from the manifest.
  3. Browse box art / title screen / in-game snapshots in preview.
  4. Adjust global settings (header height, card dimensions, sticker inset).
  5. Add cards to collection; multi-select, delete, per-card overrides.
  6. Export print-ready letter PDF (3×3 cards per page with cut marks).
- **Acceptance criteria (baseline):**
  - [x] Search requires minimum 3 characters.
  - [x] Preview updates for artwork type and alignment controls.
  - [x] Collection persists across reload via `localStorage`.
  - [x] JSON export/import round-trips settings and cards.
  - [x] PDF export produces US letter layout with cut marks.

### Platform catalog

- **Status:** Shipped
- **Summary:** 17 retro platforms (Atari 2600 through PlayStation, plus DOS, Sega CD/32X, PC Engine, Neo Geo, Arcade).
- **Behavior:** Platforms with zero indexed artwork are hidden from the selector.

### Universal card layout

- **Status:** Shipped
- **Summary:** Portrait default — top platform strip (~15% height): logo (75%) + color (25%); bottom artwork (~85%). Landscape variant follows the same long-edge split rules documented in `README.md`.
- **Configurable:** Global header height, show/hide header and platform color, per-card header and artwork display overrides.

### Artwork pipeline

- **Status:** Shipped
- **Summary:** Libretro paths on S3; manifest generated by `sync-image-manifest`. Maintainer scripts upload from a local libretro mirror.
- **Image types:** Box art, title screen, in-game (priority order configurable).

### Supporting pages

- **Status:** Shipped
- **Pages:** `supplies.html` (materials), `recognition.html` (credits), `thanks.html`, `colors.html`, `developer.html` (dev tools).

---

## Backlog

Features below are **not yet built** unless marked otherwise. Add new items at the top of this section.

<!-- Copy the feature template from the top of this file for each new idea. -->

### _(Example) Batch rename games in collection_

- **Status:** In design *(example only — remove or replace when adding real work)*
- **Problem:** Large collections are hard to scan when libretro names differ from display preferences.
- **Proposal:** Select multiple cards and apply a display-name pattern or manual rename.
- **Acceptance criteria:**
  - [ ] User can rename a single card inline in the collection list.
  - [ ] Renamed `gameName` is preserved in export JSON and PDF labels.
- **Out of scope:** Renaming libretro manifest entries or S3 objects.
- **Open questions:**
  - Should rename affect search/display only, or also PDF header text?
- **Notes:** Delete this example block when adding the first real backlog item.

---

## Open questions (global)

- None at this time. Add cross-cutting product questions here.

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
