/**
 * ── Cesium Viewer factory ──────────────────────────────────────────────
 *
 * Creates and configures a CesiumJS Viewer suitable for a local-first,
 * offline-friendly globe experience. No external tile services are required.
 *
 * The viewer is intentionally minimal — UI chrome is stripped because the
 * app provides its own controls.
 *
 * Listens for "theme-change" custom events (dispatched by ThemeToggle)
 * and swaps imagery + scene colours accordingly.
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

/* ── Theme-dependent scene colours ────────────────────────────────────── */

function applySceneTheme(scene: Scene, light: boolean): void {
  if (light) {
    scene.globe.baseColor = Color.WHITE;
    scene.backgroundColor = Color.WHITE;

    if (scene.skyAtmosphere) {
      scene.skyAtmosphere.show = false;
    }
    scene.globe.showGroundAtmosphere = false;
    scene.fog.enabled = false;
  } else {
    scene.globe.baseColor = Color.fromCssColorString("#0f1729");
    scene.backgroundColor = Color.fromCssColorString("#060a14");

    if (scene.skyAtmosphere) {
      scene.skyAtmosphere.show = true;
      scene.skyAtmosphere.brightnessShift = -0.15;
      scene.skyAtmosphere.hueShift = -0.05;
      scene.skyAtmosphere.saturationShift = 0.1;
    }
    scene.globe.showGroundAtmosphere = true;
    scene.globe.atmosphereBrightnessShift = -0.1;
    scene.globe.atmosphereSaturationShift = 0.15;
    scene.fog.enabled = true;
    scene.fog.density = 2.0e-4;
  }
}

/* ── Factory ──────────────────────────────────────────────────────────── */

/**
 * Create a Cesium Viewer mounted into the given container element.
 *
 * @param container – The HTMLElement (or its CSS id) to mount into.
 * @returns The Viewer instance.
 */
export function createViewer(container: HTMLElement | string): Viewer {
  Ion.defaultAccessToken = undefined as unknown as string;

  const viewer = new Viewer(container, {
    baseLayerPicker: false,
    baseLayer: false,
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
    creditContainer: document.createElement("div"),
    requestRenderMode: false,
    showRenderLoopErrors: false,
  });

  const scene: Scene = viewer.scene;
  scene.msaaSamples = 4;
  scene.globe.showGroundAtmosphere = true;
  scene.globe.enableLighting = false;

  if (scene.skyAtmosphere) {
    scene.skyAtmosphere.show = true;
  }

  scene.fog.enabled = true;

  const light = isLightTheme();
  applySceneTheme(scene, light);

  const controller = scene.screenSpaceCameraController;
  controller.maximumZoomDistance = 18_000_000;
  controller.minimumZoomDistance = 500;
  controller.enableZoom = true;
  controller.enableRotate = true;
  controller.enableTilt = true;
  controller.enableLook = true;
  controller.enableTranslate = true;

  setGlobeImagery(viewer, light);

  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(0, 20, 15_000_000),
  });

  /* ── React to theme changes at runtime ──────────────────────────── */

  const onThemeChange = (e: Event) => {
    if (viewer.isDestroyed()) return;
    const isLight = (e as CustomEvent<{ isLight: boolean }>).detail.isLight;
    applySceneTheme(viewer.scene, isLight);
    setGlobeImagery(viewer, isLight);
  };

  document.addEventListener("theme-change", onThemeChange);

  const originalDestroy = viewer.destroy.bind(viewer);
  viewer.destroy = () => {
    document.removeEventListener("theme-change", onThemeChange);
    originalDestroy();
  };

  return viewer;
}
