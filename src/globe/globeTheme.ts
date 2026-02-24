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

  // Day: pale horizon that doesn't blend with ocean; Night: deep space
  scene.backgroundColor = Color.fromCssColorString(
    isLight ? "#E8F4F8" : "#050508",
  );

  scene.globe.baseColor = Color.fromCssColorString(
    isLight ? "#1A6B8A" : "#030308",
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
