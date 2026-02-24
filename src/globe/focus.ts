/**
 * ── Camera focus / flight helpers ──────────────────────────────────────
 *
 * focusToRegion supports three modes:
 *   - "bbox"   : fly to a Cesium Rectangle from region_index bbox
 *   - "sphere" : compute BoundingSphere from polygon vertices
 *   - "auto"   : try sphere first, fall back to bbox
 *
 * All modes handle antimeridian crossing and are interruptible.
 */

import {
  type Viewer,
  Rectangle,
  Cartesian3,
  BoundingSphere,
  HeadingPitchRange,
  Math as CesiumMath,
} from "cesium";
import { getRegionEntry } from "../data/regionIndex";
import { extractVertices } from "../geo/vertices";
import { normalizeBBox, padBBox } from "../geo/antimeridian";
import type { BBox, FocusOptions, RegionFeatureCollection } from "../types";

/* ── Defaults ────────────────────────────────────────────────────────── */

const DEFAULT_DURATION = 1.5;
const DEFAULT_PADDING = 0.1;

/* ── Guards ──────────────────────────────────────────────────────────── */

function alive(v: Viewer): boolean {
  return !!v && !v.isDestroyed();
}

/* ── Geometry cache for sphere fits ──────────────────────────────────── */

let _geoCache: RegionFeatureCollection | null = null;

/**
 * Provide geometry data so sphere-mode can extract vertices.
 * Call this whenever the active GeoJSON changes (countries or subregions).
 */
export function setFocusGeometry(geo: RegionFeatureCollection | null): void {
  _geoCache = geo;
}

/* ── Public API ──────────────────────────────────────────────────────── */

/**
 * Fly the camera to fit a region.
 */
export function focusToRegion(
  viewer: Viewer,
  regionId: string,
  opts: FocusOptions = {},
): boolean {
  if (!alive(viewer)) return false;

  const entry = getRegionEntry(regionId);
  if (!entry) {
    console.warn(`[focus] Region "${regionId}" not found in index.`);
    return false;
  }

  viewer.camera.cancelFlight();

  const mode = opts.mode ?? "auto";
  const duration = opts.duration ?? DEFAULT_DURATION;
  const padding = opts.padding ?? DEFAULT_PADDING;

  // Try sphere mode if requested or auto
  if (mode === "sphere" || mode === "auto") {
    const ok = focusSphere(viewer, regionId, duration, padding);
    if (ok) return true;
    if (mode === "sphere") return false; // strict mode, no fallback
  }

  // Bbox fallback
  return focusBBox(viewer, entry.bbox, duration, padding);
}

/**
 * Fly to a rectangle from a bbox (antimeridian-safe).
 */
export function focusToBBox(
  viewer: Viewer,
  bbox: BBox,
  duration = DEFAULT_DURATION,
  padding = DEFAULT_PADDING,
): boolean {
  return focusBBox(viewer, bbox, duration, padding);
}

/**
 * Fly camera to the default world view.
 */
export function focusToWorld(viewer: Viewer): void {
  if (!alive(viewer)) return;
  viewer.camera.cancelFlight();
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(0, 20, 20_000_000),
    duration: DEFAULT_DURATION,
  });
}

/* ── Internal: bbox fit ──────────────────────────────────────────────── */

function focusBBox(
  viewer: Viewer,
  bbox: BBox,
  duration: number,
  padding: number,
): boolean {
  if (!alive(viewer)) return false;

  const norm = normalizeBBox(bbox);
  const padded = padBBox(norm, padding);
  const [west, south, east, north] = padded;

  const rect = Rectangle.fromDegrees(west, south, east, north);

  viewer.camera.flyTo({
    destination: rect,
    duration,
  });

  return true;
}

/* ── Internal: bounding-sphere fit ───────────────────────────────────── */

function focusSphere(
  viewer: Viewer,
  regionId: string,
  duration: number,
  padding: number,
): boolean {
  if (!_geoCache) return false;

  // Find features matching this regionId
  const features = _geoCache.features.filter((f) => f.id === regionId);
  if (features.length === 0) return false;

  // Collect vertices from all matching features
  const allVerts: Array<[number, number]> = [];
  for (const f of features) {
    const verts = extractVertices(f.geometry, 300);
    allVerts.push(...verts);
  }

  if (allVerts.length < 3) return false; // Not enough points for a meaningful sphere

  // Convert to Cartesian3
  const cartesians = allVerts.map(([lon, lat]) =>
    Cartesian3.fromDegrees(lon, lat),
  );

  const bs = BoundingSphere.fromPoints(cartesians);
  bs.radius *= 1 + padding; // Apply padding

  viewer.camera.flyToBoundingSphere(bs, {
    duration,
    offset: new HeadingPitchRange(
      0,
      CesiumMath.toRadians(-90), // Straight down
      0, // Auto-compute range
    ),
  });

  return true;
}
