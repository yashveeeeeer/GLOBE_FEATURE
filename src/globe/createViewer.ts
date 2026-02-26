/**
 * ── Cesium Viewer factory ──────────────────────────────────────────────
 *
 * Creates and configures a CesiumJS Viewer suitable for a local-first,
 * offline-friendly globe experience. No external tile services are required.
 *
 * The viewer is intentionally minimal — UI chrome is stripped because the
 * app provides its own controls.
 */

import {
  Viewer,
  Ion,
  Color,
  Cartesian3,
  type Scene,
} from "cesium";
import { setGlobeImagery } from "./imagery";
import { isLightTheme } from "./globeTheme";

/**
 * Create a Cesium Viewer mounted into the given container element.
 *
 * @param container – The HTMLElement (or its CSS id) to mount into.
 * @returns The Viewer instance.
 */
export function createViewer(container: HTMLElement | string): Viewer {
  // Suppress the "missing Ion access token" warning.
  // We don't use Ion services in this local-first setup.
  Ion.defaultAccessToken = undefined as unknown as string;

  const viewer = new Viewer(container, {
    // ── Imagery ──────────────────────────────────────────────────
    // Suppress default Bing imagery — use globe base color instead.
    // This guarantees the globe renders offline with no external fetches.
    baseLayerPicker: false,
    baseLayer: false,

    // ── Terrain ──────────────────────────────────────────────────
    // Default is EllipsoidTerrainProvider (smooth ellipsoid, no terrain).

    // ── Strip Cesium default UI chrome ───────────────────────────
    animation: false,
    timeline: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    creditContainer: document.createElement("div"), // hide credits overlay

    // ── Rendering ────────────────────────────────────────────────
    requestRenderMode: false, // render continuously so rotation is smooth
    // Don't show Cesium's built-in error panel (e.g. "connection failed" from
    // resource load failures); the app shows its own ErrorBanner in the sidebar.
    showRenderLoopErrors: false,
  });

  const scene: Scene = viewer.scene;
  scene.msaaSamples = 4;
  scene.globe.baseColor = Color.fromCssColorString("#0f1729");
  scene.globe.showGroundAtmosphere = true;
  scene.globe.enableLighting = false;
  scene.backgroundColor = Color.fromCssColorString("#060a14");

  if (scene.skyAtmosphere) {
    scene.skyAtmosphere.show = true;
    scene.skyAtmosphere.brightnessShift = -0.15;
    scene.skyAtmosphere.hueShift = -0.05;
    scene.skyAtmosphere.saturationShift = 0.1;
  }

  scene.fog.enabled = true;
  scene.fog.density = 2.0e-4;
  scene.globe.atmosphereBrightnessShift = -0.1;
  scene.globe.atmosphereSaturationShift = 0.15;

  // Limit zoom range so the user can't zoom out past a reasonable distance
  // or zoom in closer than ~500m. Prevents the globe becoming a tiny dot
  // or the camera clipping into the surface.
  const controller = scene.screenSpaceCameraController;
  controller.maximumZoomDistance = 18_000_000;
  controller.minimumZoomDistance = 500;
  controller.enableZoom = true;
  controller.enableRotate = true;
  controller.enableTilt = true;
  controller.enableLook = true;
  controller.enableTranslate = true;

  setGlobeImagery(viewer, isLightTheme());

  // Set a comfortable initial camera position so the globe fills the pane
  // nicely on widescreen PC monitors (~65 % of viewport).
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(0, 20, 15_000_000),
  });

  return viewer;
}
