import { loadGameCatalog } from "./gameCatalog.js";
import { loadPlatformDefaultsSeed } from "./platformDefaults.js";
import { reloadSettingsFromStorage } from "./state.js";
import { initUI } from "./ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadPlatformDefaultsSeed();
    reloadSettingsFromStorage();
    await loadGameCatalog();
    await initUI();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load game catalog.";
    console.error(message, err);
  }
});
