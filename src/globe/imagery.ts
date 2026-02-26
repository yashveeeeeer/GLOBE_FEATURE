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

function cancelPendingFade(): void {
  if (_fadeRaf) {
    cancelAnimationFrame(_fadeRaf);
    _fadeRaf = 0;
  }
}

/**
 * Animate `layer.alpha` from `from` to `to` over `durationMs`, then call
 * `onDone`. Uses requestAnimationFrame for smooth 60fps interpolation.
 */
function fadeLayer(
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

  const layers = viewer.imageryLayers;
  const oldCount = layers.length;

  try {
    let newLayer: ImageryLayer;
    if (isLight) {
      const day = await createDayProvider();
      if (viewer.isDestroyed()) return;
      newLayer = layers.addImageryProvider(day);
    } else {
      const night = createNightProvider();
      newLayer = layers.addImageryProvider(night);
    }

    if (oldCount === 0) {
      newLayer.alpha = 1.0;
      return;
    }

    newLayer.alpha = 0;
    fadeLayer(newLayer, 0, 1, CROSSFADE_MS, () => {
      if (viewer.isDestroyed()) return;
      while (layers.length > 1) {
        layers.remove(layers.get(0), true);
      }
    });
  } catch (err) {
    console.warn("[imagery] Failed to load imagery, falling back to base color", err);
    layers.removeAll();
  }
}
