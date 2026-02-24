/**
 * ── Globe Theme ────────────────────────────────────────────────────────
 *
 * Theme utilities for the Cesium globe scene.
 */

/**
 * Read the current theme from localStorage (same key as ThemeToggle).
 */
export function isLightTheme(): boolean {
  try {
    return localStorage.getItem("commenda-theme") === "light";
  } catch {
    return false;
  }
}
