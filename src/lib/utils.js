// @ts-check

/**
 * @param {string | undefined} value
 * @param {string[]} fallback
 */
export function csv(value, fallback) {
  if (!value) return fallback;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : fallback;
}

/**
 * @param {number | null | undefined} value
 * @param {number} decimals
 */
export function round(value, decimals = 1) {
  if (value == null || Number.isNaN(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {number[]} values
 */
export function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * @param {number[]} values
 */
export function sum(values) {
  if (!values.length) return null;
  return values.reduce((acc, value) => acc + value, 0);
}

/**
 * @param {number[]} values
 */
export function max(values) {
  if (!values.length) return null;
  return Math.max(...values);
}

/**
 * @param {number[]} values
 */
export function min(values) {
  if (!values.length) return null;
  return Math.min(...values);
}

/**
 * @param {string} iso
 */
export function getLocalDateKey(iso) {
  return iso.slice(0, 10);
}

/**
 * @param {string} iso
 */
export function getHour(iso) {
  return Number(iso.slice(11, 13));
}

/**
 * @param {string} iso
 */
export function formatHour(iso) {
  return `${iso.slice(11, 13)}:00`;
}
