import { loadGameCatalog } from "./gameCatalog.js";
import { loadImageAvailability } from "./imageAvailability.js";
import { initUI } from "./ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadGameCatalog();
    await loadImageAvailability();
    await initUI();
  } catch (err) {
    const status = document.getElementById("status");
    const message = err instanceof Error ? err.message : "Failed to load game catalog.";
    if (status) {
      status.textContent = message;
      status.classList.add("status--error");
    }
    console.error(err);
  }
});
