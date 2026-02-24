/**
 * ── Globe Theme ────────────────────────────────────────────────────────
 *
 * Applies visual theme to the Cesium globe scene: background, ocean color,
 * atmosphere, stars. Called on initial load and on every theme toggle.
 */

import { type Viewer, Color } from "cesium";
import { setGlobeImagery } from "./imagery";

export function applyGlobeTheme(viewer: Viewer, isLight: boolean): void {
  if (!viewer || viewer.isDestroyed()) return;

  const scene = viewer.scene;

  // Day: soft sky-blue backdrop; Night: deep space black
  scene.backgroundColor = Color.fromCssColorString(
    isLight ? "#87CEEB" : "#0B0F1A",
  );

  scene.globe.baseColor = Color.fromCssColorString(
    isLight ? "#DBEAFE" : "#1a1d2e",
  );

  // Atmosphere glow visible in both modes
  if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
  scene.globe.showGroundAtmosphere = true;

  // Stars only at night
  if (scene.skyBox) {
    scene.skyBox.show = !isLight;
  }

  setGlobeImagery(viewer, isLight);
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
