/**
 * ── Imagery Providers ─────────────────────────────────────────────────
 *
 * Day:   Cesium's bundled Natural Earth II tiles (no external service).
 * Night: NASA GIBS VIIRS Black Marble (free, no API key).
 */

import {
  type Viewer,
  type ImageryLayer,
  TileMapServiceImageryProvider,
  UrlTemplateImageryProvider,
  GeographicTilingScheme,
  Credit,
} from "cesium";

/* eslint-disable @typescript-eslint/no-explicit-any */

const NIGHT_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/" +
  "VIIRS_Black_Marble/default/2016-01-01/500m/{z}/{y}/{x}.png";

async function createDayProvider(): Promise<TileMapServiceImageryProvider> {
  return TileMapServiceImageryProvider.fromUrl(
    `${CESIUM_BASE_URL}/Assets/Textures/NaturalEarthII`,
  );
}

function createNightProvider(): UrlTemplateImageryProvider {
  return new UrlTemplateImageryProvider({
    url: NIGHT_URL,
    tilingScheme: new GeographicTilingScheme(),
    maximumLevel: 8,
    credit: new Credit("NASA EOSDIS GIBS"),
  });
}

/**
 * Set the globe imagery to day (Natural Earth II) or night (Black Marble).
 * Removes all existing imagery layers first.
 */
export async function setGlobeImagery(
  viewer: Viewer,
  isLight: boolean,
): Promise<void> {
  if (!viewer || viewer.isDestroyed()) return;

  const layers = viewer.imageryLayers;
  layers.removeAll();

  try {
    let layer: ImageryLayer;
    if (isLight) {
      const day = await createDayProvider();
      layer = layers.addImageryProvider(day);
    } else {
      const night = createNightProvider();
      layer = layers.addImageryProvider(night);
    }
    layer.alpha = 1.0;
  } catch (err) {
    console.warn("[imagery] Failed to load imagery, falling back to base color", err);
  }
}
