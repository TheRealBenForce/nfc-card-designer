(function () {
  const STORAGE_KEY = "nfc-card-designer-theme";
  const TRANSITION_MS = 320;

  /** @returns {"light" | "dark"} */
  function getPreferredTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  /** @param {"light" | "dark"} theme */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  }

  applyTheme(getPreferredTheme());

  /** @param {"light" | "dark"} theme */
  function syncToggleButton(theme) {
    const button = document.getElementById("theme-toggle");
    if (!button) return;

    const isDark = theme === "dark";
    button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    button.setAttribute("title", isDark ? "Light mode" : "Dark mode");
  }

  function runThemeTransition(update) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      update();
      return;
    }

    document.documentElement.classList.add("theme-transition");
    update();
    window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, TRANSITION_MS);
  }

  function bindToggle() {
    const button = document.getElementById("theme-toggle");
    if (!button || button.dataset.themeBound === "true") return;
    button.dataset.themeBound = "true";

    syncToggleButton(
      document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
    );

    button.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";

      runThemeTransition(() => {
        applyTheme(next);
        localStorage.setItem(STORAGE_KEY, next);
        syncToggleButton(next);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindToggle);
  } else {
    bindToggle();
  }
})();
