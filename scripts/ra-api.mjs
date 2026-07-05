import { loadRaApiKey } from "./env.js";

const BASE_URL = "https://retroachievements.org/API";
const USER_AGENT = "nfc-card-designer/1.0";

/**
 * @param {string} endpoint e.g. "API_GetGame.php"
 * @param {Record<string, string|number>} params
 */
export async function raFetch(endpoint, params = {}) {
  const apiKey = await loadRaApiKey();
  const url = new URL(`${BASE_URL}/${endpoint}`);

  url.searchParams.set("y", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} for ${endpoint}: ${body.slice(0, 120)}`);
  }

  return response.json();
}

/**
 * @param {number} consoleId
 */
export async function getGameList(consoleId) {
  return raFetch("API_GetGameList.php", { i: consoleId, f: 1 });
}

/**
 * @param {number} gameId
 */
export async function getGame(gameId) {
  return raFetch("API_GetGame.php", { i: gameId });
}
