/**
 * ── Vertex extraction from GeoJSON geometry ────────────────────────────
 *
 * Walks Polygon / MultiPolygon / GeometryCollection coordinates and
 * returns a flat array of [lon, lat] pairs. Supports stride-based
 * sampling to cap the count for large polygons.
 */

import type { GeoJsonGeometry } from "../types";

/**
 * Extract coordinate pairs from a geometry.
 *
 * @param geometry  GeoJSON geometry object
 * @param maxCount  Maximum vertices to return (stride-sampled if exceeded). Default: 500.
 * @returns         Array of [lon, lat] pairs.
 */
export function extractVertices(
  geometry: GeoJsonGeometry,
  maxCount = 500,
): Array<[number, number]> {
  const all: Array<[number, number]> = [];
  collectCoords(geometry, all);

  if (all.length <= maxCount) return all;

  // Stride sampling — keep first, last, and evenly spaced points
  const stride = Math.ceil(all.length / maxCount);
  const sampled: Array<[number, number]> = [];
  for (let i = 0; i < all.length; i += stride) {
    sampled.push(all[i]!);
  }
  return sampled;
}

function collectCoords(
  geom: GeoJsonGeometry,
  out: Array<[number, number]>,
): void {
  if (!geom) return;

  if (geom.type === "GeometryCollection" && geom.geometries) {
    for (const g of geom.geometries) collectCoords(g, out);
    return;
  }

  const coords = geom.coordinates;
  if (!coords) return;
  walkCoords(coords as unknown[], out);
}

function walkCoords(
  arr: unknown[],
  out: Array<[number, number]>,
): void {
  if (arr.length === 0) return;

  // Leaf: [number, number, ...] — a coordinate
  if (typeof arr[0] === "number") {
    out.push([arr[0] as number, arr[1] as number]);
    return;
  }

  // Recurse into nested arrays
  for (const item of arr) {
    if (Array.isArray(item)) walkCoords(item, out);
  }
}
