/**
 * ── Globe Theme ────────────────────────────────────────────────────────
 *
 * Applies visual theme to the Cesium globe scene: background, ocean color,
 * atmosphere, stars. Called on initial load and on every theme toggle.
 */

import { type Viewer, Color } from "cesium";

export function applyGlobeTheme(viewer: Viewer, isLight: boolean): void {
  if (!viewer || viewer.isDestroyed()) return;

  const scene = viewer.scene;

  // Space background — match sidebar
  scene.backgroundColor = Color.fromCssColorString(
    isLight ? "#F8FAFC" : "#0B0F1A",
  );

  // Globe base color (oceans/land with no imagery)
  scene.globe.baseColor = Color.fromCssColorString(
    isLight ? "#DBEAFE" : "#1a1d2e",
  );

  // Atmosphere glow ring
  scene.skyAtmosphere.show = !isLight;
  scene.globe.showGroundAtmosphere = !isLight;

  // Stars
  if (scene.skyBox) {
    scene.skyBox.show = !isLight;
  }
}

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
