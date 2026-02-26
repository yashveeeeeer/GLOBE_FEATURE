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

let _transitionToken = 0;

/**
 * Switch to target imagery (day/night) without removing the currently
 * visible layer until the new one is successfully added.
 */
export async function setGlobeImagery(
  viewer: Viewer,
  isLight: boolean,
): Promise<void> {
  if (!viewer || viewer.isDestroyed()) return;
  const token = ++_transitionToken;

  const layers = viewer.imageryLayers;
  const oldLayers: ImageryLayer[] = [];
  for (let i = 0; i < layers.length; i++) {
    oldLayers.push(layers.get(i));
  }

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
    newLayer.alpha = 1.0;
    for (const oldLayer of oldLayers) {
      if (oldLayer !== newLayer) layers.remove(oldLayer, true);
    }
  } catch (err) {
    console.warn("[imagery] Failed to switch imagery; keeping previous layer", err);
  }
}
