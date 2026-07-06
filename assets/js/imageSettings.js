import { DEFAULT_IMAGE_TYPE_PRIORITY, IMAGE_TYPES } from "./config.js";

/**
 * @param {unknown} priority
 * @returns {string[]}
 */
export function normalizeImageTypePriority(priority) {
  const validTypes = DEFAULT_IMAGE_TYPE_PRIORITY.filter((type) => IMAGE_TYPES[type]);
  if (!Array.isArray(priority) || priority.length === 0) {
    return [...validTypes];
  }

  /** @type {string[]} */
  const normalized = [];
  for (const type of priority) {
    if (typeof type === "string" && IMAGE_TYPES[type] && !normalized.includes(type)) {
      normalized.push(type);
    }
  }

  for (const type of validTypes) {
    if (!normalized.includes(type)) normalized.push(type);
  }

  return normalized;
}

/**
 * @param {string[]} types
 * @param {string[]} priority
 */
export function sortTypesByPriority(types, priority) {
  const order = new Map(priority.map((type, index) => [type, index]));
  return [...types].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
}

/**
 * @param {string[]} priority
 * @param {number} index
 */
export function movePriorityItem(priority, index, direction) {
  const next = [...priority];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
