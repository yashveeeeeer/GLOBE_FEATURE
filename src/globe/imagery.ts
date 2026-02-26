/**
 * ── Imagery Providers ─────────────────────────────────────────────────
 *
 * Day:   Cesium's bundled Natural Earth II tiles (local, no network).
 * Night: NASA GIBS VIIRS City Lights (WebMercator, free, no API key).
 *
 * Theme switches use a cross-dissolve: the new layer fades in on top of
 * the old one so the globe never goes blank.
 */

import {
  type Viewer,
  type ImageryLayer,
  TileMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
  WebMercatorTilingScheme,
  Credit,
} from "cesium";

const CROSSFADE_MS = 700;

async function createDayProvider(): Promise<TileMapServiceImageryProvider> {
  return TileMapServiceImageryProvider.fromUrl(
    `${CESIUM_BASE_URL}/Assets/Textures/NaturalEarthII`,
  );
}

function createNightProvider(): WebMapTileServiceImageryProvider {
  return new WebMapTileServiceImageryProvider({
    url: "https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg",
    layer: "VIIRS_CityLights_2012",
    style: "default",
    tileMatrixSetID: "GoogleMapsCompatible_Level8",
    maximumLevel: 8,
    format: "image/jpeg",
    tilingScheme: new WebMercatorTilingScheme(),
    credit: new Credit("NASA EOSDIS GIBS"),
  });
}

let _fadeRaf = 0;
let _transitionToken = 0;

function cancelPendingFade(): void {
  if (_fadeRaf) {
    cancelAnimationFrame(_fadeRaf);
    _fadeRaf = 0;
  }
}

/**
 * Animate `layer.alpha` from `from` to `to` over `durationMs`, then call
 * `onDone`. Uses requestAnimationFrame for smooth 60fps interpolation.
 * Accepts a `viewer` ref so it can bail out if the viewer is destroyed
 * mid-animation (prevents silent render-loop crashes).
 */
function fadeLayer(
  viewer: Viewer,
  layer: ImageryLayer,
  from: number,
  to: number,
  durationMs: number,
  onDone?: () => void,
): void {
  cancelPendingFade();
  const start = performance.now();
  layer.alpha = from;

  const step = (now: number) => {
    if (viewer.isDestroyed()) {
      _fadeRaf = 0;
      return;
    }
    const t = Math.min((now - start) / durationMs, 1);
    const eased = t * t * (3 - 2 * t);
    layer.alpha = from + (to - from) * eased;
    if (t < 1) {
      _fadeRaf = requestAnimationFrame(step);
    } else {
      layer.alpha = to;
      _fadeRaf = 0;
      onDone?.();
    }
  };
  _fadeRaf = requestAnimationFrame(step);
}

/**
 * Cross-dissolve to the target imagery (day or night). The new layer
 * fades in on top of the old one so the globe is never blank.
 */
export async function setGlobeImagery(
  viewer: Viewer,
  isLight: boolean,
): Promise<void> {
  if (!viewer || viewer.isDestroyed()) return;
  cancelPendingFade();
  const token = ++_transitionToken;

  const layers = viewer.imageryLayers;
  // Rapid theme toggles can leave multiple transitional layers alive.
  // Collapse to a single stable base layer before starting a new transition.
  if (layers.length > 1) {
    const top = layers.get(layers.length - 1);
    top.alpha = 1;
    while (layers.length > 1) {
      layers.remove(layers.get(0), true);
    }
  }
  const oldCount = layers.length;
  const oldLayer = oldCount > 0 ? layers.get(oldCount - 1) : undefined;

  try {
    let newLayer: ImageryLayer;
    if (isLight) {
      const day = await createDayProvider();
      if (viewer.isDestroyed() || token !== _transitionToken) return;
      newLayer = layers.addImageryProvider(day);
    } else {
      const night = createNightProvider();
      if (token !== _transitionToken) return;
      newLayer = layers.addImageryProvider(night);
    }

    if (oldCount === 0) {
      newLayer.alpha = 1.0;
      return;
    }

    newLayer.alpha = 0;
    fadeLayer(viewer, newLayer, 0, 1, CROSSFADE_MS, () => {
      if (viewer.isDestroyed() || token !== _transitionToken) return;
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers.get(i);
        if (layer !== newLayer) layers.remove(layer, true);
      }
    });
    if (oldLayer) oldLayer.alpha = 1;
  } catch (err) {
    console.warn("[imagery] Failed to load imagery, falling back to base color", err);
    if (token === _transitionToken) {
      layers.removeAll();
    }
  }
}
