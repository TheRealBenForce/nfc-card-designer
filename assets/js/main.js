import { loadGameCatalog } from "./gameCatalog.js";
import { loadImageAvailability } from "./imageAvailability.js";
import { initUI } from "./ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadGameCatalog();
    await loadImageAvailability();
    await initUI();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load game catalog.";
    console.error(message, err);
  }
});
