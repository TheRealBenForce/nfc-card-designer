/** @type {HTMLDialogElement | null} */
let dialogEl = null;
/** @type {HTMLElement | null} */
let titleEl = null;
/** @type {HTMLElement | null} */
let messageEl = null;
/** @type {HTMLButtonElement | null} */
let cancelBtn = null;
/** @type {HTMLButtonElement | null} */
let confirmBtn = null;

/** @type {((value: boolean) => void) | null} */
let resolvePromise = null;

/**
 * @param {boolean} result
 */
function settle(result) {
  if (!resolvePromise) return;
  const resolve = resolvePromise;
  resolvePromise = null;
  dialogEl?.close();
  resolve(result);
}

function bindEvents() {
  dialogEl?.addEventListener("close", () => {
    if (!resolvePromise) return;
    const resolve = resolvePromise;
    resolvePromise = null;
    resolve(false);
  });

  dialogEl?.addEventListener("click", (e) => {
    if (e.target === dialogEl) {
      settle(false);
    }
  });

  cancelBtn?.addEventListener("click", () => settle(false));
  confirmBtn?.addEventListener("click", () => settle(true));
  document.getElementById("confirm-modal-close")?.addEventListener("click", () => settle(false));
}

export function initConfirmModal() {
  dialogEl = /** @type {HTMLDialogElement | null} */ (document.getElementById("confirm-modal"));
  titleEl = document.getElementById("confirm-modal-title");
  messageEl = document.getElementById("confirm-modal-message");
  cancelBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById("confirm-modal-cancel"));
  confirmBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById("confirm-modal-confirm"));
  bindEvents();
}

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmLabel]
 * @param {string} [options.cancelLabel]
 * @param {"danger" | "primary"} [options.confirmVariant]
 * @returns {Promise<boolean>}
 */
export function showConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
}) {
  if (!dialogEl || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
    return Promise.resolve(false);
  }

  titleEl.textContent = title;
  messageEl.textContent = message;
  confirmBtn.textContent = confirmLabel;
  cancelBtn.textContent = cancelLabel;

  confirmBtn.classList.remove("btn--danger", "btn--primary");
  confirmBtn.classList.add(confirmVariant === "primary" ? "btn--primary" : "btn--danger");

  return new Promise((resolve) => {
    resolvePromise = resolve;
    dialogEl.showModal();
    cancelBtn.focus();
  });
}
