import { platforms } from "./data/platforms.js";
import { games } from "./data/games.js";
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
 * @param {typeof games} catalogGames
 */
function buildLocalGameSections(catalogGames) {
  const platformOrder = platforms.map((platform) => platform.id);
  /** @type {Record<string, { name: string, raGameId: number, types: string[] }[]>} */
  const grouped = {};

  for (const game of catalogGames) {
    const types = Object.entries(game.images ?? {})
      .filter(([, imagePath]) => Boolean(imagePath))
      .map(([type]) => type)
      .sort();
    if (types.length === 0) continue;

    if (!grouped[game.platformId]) grouped[game.platformId] = [];
    grouped[game.platformId].push({
      name: game.name,
      raGameId: game.raGameId,
      types,
    });
  }

  const extraPlatformIds = Object.keys(grouped).filter((id) => !platformOrder.includes(id));
  const orderedPlatformIds = [...platformOrder, ...extraPlatformIds.sort()];

  /** @type {{ platformId: string, platformName: string, games: { name: string, raGameId: number, types: string[] }[] }[]} */
  const sections = [];

  for (const platformId of orderedPlatformIds) {
    const platformGames = grouped[platformId];
    if (!platformGames || platformGames.length === 0) continue;

    platformGames.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    sections.push({
      platformId,
      platformName: platforms.find((platform) => platform.id === platformId)?.name ?? platformId,
      games: platformGames,
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
      "No artwork metadata in games.js. Run fetch-images or sync from S3.";
    localGamesEl.innerHTML = '<p class="empty-hint">No games with image paths in games.js.</p>';
    return;
  }

  localGamesMetaEl.textContent = `${totalGames} game(s) with artwork metadata across ${sections.length} platform(s).`;

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

function refreshLocalGames() {
  if (!localGamesEl || !localGamesMetaEl) return;
  renderLocalGames(buildLocalGameSections(games));
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

export function initDeveloperPage() {
  localGamesMetaEl = document.getElementById("dev-local-games-meta");
  localGamesEl = document.getElementById("dev-local-games");
  collectionJsonEl = document.getElementById("dev-collection-json");

  bindDelayControls();
  refreshLocalGames();
  renderCollectionJson();
}
