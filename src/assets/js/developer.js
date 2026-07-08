import { platforms } from "./data/platforms.js";
import { COLLECTION_STORAGE_KEY, DEV_IMAGE_DELAY_MAX_MS, DEV_IMAGE_DELAY_STORAGE_KEY, STORAGE_KEY } from "./config.js";
import { getDevImageDelayMs, setDevImageDelayMs } from "./devTools.js";
import { loadSettings, loadCollection } from "./storage.js";

/** @type {HTMLInputElement|null} */
let delayRangeEl = null;
/** @type {HTMLInputElement|null} */
let delayInputEl = null;
/** @type {HTMLElement|null} */
let delayStatusEl = null;
/** @type {HTMLElement|null} */
let localGamesMetaEl = null;
/** @type {HTMLElement|null} */
let localGamesEl = null;
/** @type {HTMLElement|null} */
let collectionJsonEl = null;

/**
 * @param {number} ms
 */
function formatDelayStatus(ms) {
  if (ms <= 0) return "No artificial delay.";
  return `Each image load waits ${ms} ms before fetching (max ${DEV_IMAGE_DELAY_MAX_MS} ms).`;
}

/**
 * @param {number} value
 * @returns {number}
 */
function clampDelay(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, Math.round(value)), DEV_IMAGE_DELAY_MAX_MS);
}

function syncDelayControls(value) {
  const ms = clampDelay(value);
  if (delayRangeEl) delayRangeEl.value = String(ms);
  if (delayInputEl) delayInputEl.value = String(ms);
  if (delayStatusEl) delayStatusEl.textContent = formatDelayStatus(ms);
}

function bindDelayControls() {
  delayRangeEl = /** @type {HTMLInputElement|null} */ (document.getElementById("dev-image-delay-range"));
  delayInputEl = /** @type {HTMLInputElement|null} */ (document.getElementById("dev-image-delay-input"));
  delayStatusEl = document.getElementById("dev-image-delay-status");

  const initial = getDevImageDelayMs();
  syncDelayControls(initial);

  const applyDelay = (value) => {
    const ms = setDevImageDelayMs(value);
    syncDelayControls(ms);
  };

  delayRangeEl?.addEventListener("input", (event) => {
    applyDelay(Number(/** @type {HTMLInputElement} */ (event.target).value));
  });

  delayInputEl?.addEventListener("change", (event) => {
    applyDelay(Number(/** @type {HTMLInputElement} */ (event.target).value));
  });
}

/**
 * @param {Record<string, Record<string, string[]>>} availability
 * @param {Record<string, { name: string, raGameId: number }[]>} catalog
 */
function buildLocalGameSections(availability, catalog) {
  const platformOrder = platforms.map((platform) => platform.id);
  const extraPlatformIds = Object.keys(availability).filter((id) => !platformOrder.includes(id));
  const orderedPlatformIds = [...platformOrder, ...extraPlatformIds.sort()];

  /** @type {{ platformId: string, platformName: string, games: { name: string, raGameId: number, types: string[] }[] }[]} */
  const sections = [];

  for (const platformId of orderedPlatformIds) {
    const gamesOnDisk = availability[platformId];
    if (!gamesOnDisk) continue;

    const catalogEntries = catalog[platformId] ?? [];
    const nameById = new Map(catalogEntries.map((entry) => [String(entry.raGameId), entry.name]));

    const games = Object.entries(gamesOnDisk)
      .map(([raGameId, types]) => ({
        name: nameById.get(raGameId) ?? `Game ${raGameId}`,
        raGameId: Number(raGameId),
        types: [...types].sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    if (games.length === 0) continue;

    sections.push({
      platformId,
      platformName: platforms.find((platform) => platform.id === platformId)?.name ?? platformId,
      games,
    });
  }

  return sections;
}

/**
 * @param {{ platformId: string, platformName: string, games: { name: string, raGameId: number, types: string[] }[] }[]} sections
 */
function renderLocalGames(sections) {
  if (!localGamesEl || !localGamesMetaEl) return;

  const totalGames = sections.reduce((sum, section) => sum + section.games.length, 0);
  if (totalGames === 0) {
    localGamesMetaEl.textContent =
      "No local artwork found. Run npm run sync-s3-sample-images or fetch-images --local-only.";
    localGamesEl.innerHTML = '<p class="empty-hint">No PNGs indexed in assets/data/image-availability.json.</p>';
    return;
  }

  localGamesMetaEl.textContent = `${totalGames} game(s) with on-disk artwork across ${sections.length} platform(s).`;

  localGamesEl.replaceChildren();
  for (const section of sections) {
    const details = document.createElement("details");
    details.className = "dev-local-games__platform";
    details.open = sections.length === 1;

    const summary = document.createElement("summary");
    summary.className = "dev-local-games__summary";
    summary.textContent = `${section.platformName} (${section.games.length})`;
    details.appendChild(summary);

    const list = document.createElement("ul");
    list.className = "dev-local-games__list";
    for (const game of section.games) {
      const item = document.createElement("li");
      item.className = "dev-local-games__item";
      item.innerHTML = `<span class="dev-local-games__name">${escapeHtml(game.name)}</span>
        <span class="dev-local-games__meta">#${game.raGameId} · ${escapeHtml(game.types.join(", "))}</span>`;
      list.appendChild(item);
    }

    details.appendChild(list);
    localGamesEl.appendChild(details);
  }
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function refreshLocalGames() {
  if (!localGamesEl || !localGamesMetaEl) return;

  localGamesMetaEl.textContent = "Loading image index…";
  localGamesEl.replaceChildren();

  try {
    const [availabilityRes, catalogRes] = await Promise.all([
      fetch("assets/data/image-availability.json"),
      fetch("assets/data/games-by-platform.json"),
    ]);

    if (!availabilityRes.ok) {
      throw new Error(`image-availability.json (${availabilityRes.status})`);
    }
    if (!catalogRes.ok) {
      throw new Error(`games-by-platform.json (${catalogRes.status})`);
    }

    const availability = /** @type {{ platforms?: Record<string, Record<string, string[]>> }} */ (
      await availabilityRes.json()
    );
    const catalog = /** @type {{ platforms?: Record<string, { name: string, raGameId: number }[]> }} */ (
      await catalogRes.json()
    );

    renderLocalGames(buildLocalGameSections(availability.platforms ?? {}, catalog.platforms ?? {}));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load local game index.";
    localGamesMetaEl.textContent = message;
    localGamesEl.innerHTML = `<p class="empty-hint">${escapeHtml(message)}</p>`;
  }
}

function renderCollectionJson() {
  if (!collectionJsonEl) return;

  const settings = loadSettings();
  const collection = loadCollection();
  const payload = {
    version: 4,
    settingsStorageKey: STORAGE_KEY,
    collectionStorageKey: COLLECTION_STORAGE_KEY,
    platformDefaults: settings.platformDefaults,
    selectedPlatformId: settings.selectedPlatformId,
    cards: collection,
  };

  collectionJsonEl.textContent = JSON.stringify(payload, null, 2);
}

function bindRefreshButtons() {
  document.getElementById("dev-refresh-local-games")?.addEventListener("click", () => {
    void refreshLocalGames();
  });
  document.getElementById("dev-refresh-collection")?.addEventListener("click", renderCollectionJson);
}

function bindStorageEvents() {
  window.addEventListener("storage", (event) => {
    if (event.key === COLLECTION_STORAGE_KEY || event.key === STORAGE_KEY) {
      renderCollectionJson();
    }
    if (event.key === DEV_IMAGE_DELAY_STORAGE_KEY) {
      syncDelayControls(getDevImageDelayMs());
    }
  });
}

function init() {
  const storageKeyEl = document.getElementById("dev-collection-storage-key");
  if (storageKeyEl) storageKeyEl.textContent = COLLECTION_STORAGE_KEY;

  localGamesMetaEl = document.getElementById("dev-local-games-meta");
  localGamesEl = document.getElementById("dev-local-games");
  collectionJsonEl = document.getElementById("dev-collection-json");

  bindDelayControls();
  bindRefreshButtons();
  bindStorageEvents();
  renderCollectionJson();
  void refreshLocalGames();
}

init();
