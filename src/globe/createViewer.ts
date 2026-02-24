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
  type Scene,
} from "cesium";

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

  // Set globe base colour (dark ocean blue) and configure rendering
  const scene: Scene = viewer.scene;
  scene.msaaSamples = 1;
  scene.globe.baseColor = Color.fromCssColorString("#1a1d2e");
  scene.globe.showGroundAtmosphere = true;
  scene.globe.enableLighting = false;
  scene.skyAtmosphere.show = true;
  scene.backgroundColor = Color.fromCssColorString("#0b0e17");

  // Limit zoom range so the user can't zoom out past a reasonable distance
  // or zoom in closer than ~500m. Prevents the globe becoming a tiny dot
  // or the camera clipping into the surface.
  scene.screenSpaceCameraController.maximumZoomDistance = 25_000_000; // 25,000 km
  scene.screenSpaceCameraController.minimumZoomDistance = 500;        // 500 m

  // Force-hide Cesium's error panel and any other element showing "connection failed"
  // (except our sidebar). Search entire document.
  const hideErrorPanels = (): void => {
    document.querySelectorAll(".cesium-widget-errorPanel").forEach((el) => {
      (el as HTMLElement).style.setProperty("display", "none", "important");
    });
    // Hide any element with cesium/error in class that contains "connection failed" text.
    document.querySelectorAll("[class*='cesium'][class*='error'], [class*='cesium-widget']").forEach((el) => {
      const elHtml = el as HTMLElement;
      if (elHtml.closest(".app__sidebar")) return; // don't touch our sidebar
      const text = (elHtml.textContent || "").toLowerCase();
      if (text.includes("connection") && text.includes("fail")) {
        elHtml.style.setProperty("display", "none", "important");
      }
    });
  };
  hideErrorPanels();
  const obs = new MutationObserver(hideErrorPanels);
  const root: HTMLElement | null =
    typeof container === "string" ? document.querySelector(container) : container;
  if (root) obs.observe(root, { childList: true, subtree: true });
  obs.observe(document.body, { childList: true, subtree: true });

  return viewer;
}
