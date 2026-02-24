/**
 * ── Antimeridian-aware bbox utilities ──────────────────────────────────
 *
 * Handles bounding boxes that cross the 180° meridian by normalizing
 * them to the shorter longitude arc.
 */

import type { BBox, Centroid } from "../types";

/**
 * Normalize a bbox so it uses the shorter longitude arc.
 *
 * If `east - west > 180` the bbox likely crosses the antimeridian.
 * We keep the original values (Cesium's Rectangle.fromDegrees handles
 * west > east correctly) but clamp to valid ranges.
 */
export function normalizeBBox(bbox: BBox): BBox {
  let [west, south, east, north] = bbox;

  // Clamp latitude
  south = Math.max(south, -89.99);
  north = Math.min(north, 89.99);

  const span = east - west;
  if (span > 180) {
    // The bbox wraps the long way — swap to short arc
    // e.g. bbox [-178, x, 179, y] has span 357°
    // Swap: west=179, east=-178+360=182 → but we keep west > east for Cesium
    const tmp = west;
    west = east;
    east = tmp;
  }

  return [west, south, east, north];
}

/**
 * Compute a centroid from a bbox, handling antimeridian crossing.
 */
export function computeCentroidFromBBox(bbox: BBox): Centroid {
  const [west, south, east, north] = bbox;
  const lat = (south + north) / 2;

  let lon: number;
  if (west > east) {
    // Antimeridian crossing — average via the short arc
    lon = (west + east + 360) / 2;
    if (lon > 180) lon -= 360;
  } else {
    lon = (west + east) / 2;
  }

  return [lon, lat];
}

/**
 * Apply padding to a bbox (fraction, e.g. 0.1 = 10%).
 */
export function padBBox(bbox: BBox, padding: number): BBox {
  const [west, south, east, north] = bbox;
  const lonPad = Math.abs(east - west) * padding;
  const latPad = Math.abs(north - south) * padding;

  return [
    west - lonPad,
    Math.max(south - latPad, -89.99),
    east + lonPad,
    Math.min(north + latPad, 89.99),
  ];
}
