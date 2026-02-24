/**
 * ── Imagery Providers ─────────────────────────────────────────────────
 *
 * Day:   Cesium's bundled Natural Earth II tiles (local, no network).
 * Night: NASA GIBS VIIRS City Lights (WebMercator, free, no API key).
 */

import {
  type Viewer,
  type ImageryLayer,
  TileMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
  WebMercatorTilingScheme,
  Credit,
} from "cesium";

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

/**
 * Set the globe imagery to day (Natural Earth II) or night (City Lights).
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
