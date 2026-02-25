#!/usr/bin/env node
/**
 * fix-antimeridian.mjs
 *
 * Re-generates countries.geo.json from countries.topo.json and fixes
 * CesiumJS rendering artifacts caused by oversized polygons.
 *
 * Root cause: CesiumJS projects polygon vertices onto a local 2D tangent
 * plane for triangulation. Polygons wider than ~120° of longitude create
 * heavily distorted projections, producing visible fill artifacts (arcs).
 * CesiumJS tries to split large polygons at the equator, but that only
 * helps polygons that cross the equator.
 *
 * Fix: split any polygon ring whose longitude span exceeds MAX_LON_SPAN
 * at evenly-spaced meridians so every piece stays well under the
 * CesiumJS 120° internal threshold.
 *
 * Usage:  node scripts/fix-antimeridian.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as topojsonClient from "topojson-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TOPO_PATH = join(ROOT, "public", "data", "countries.topo.json");
const GEO_PATH = join(ROOT, "public", "data", "countries.geo.json");

const MAX_LON_SPAN = 90;

/* ── Step 1: Convert TopoJSON → GeoJSON ──────────────────────────────── */

console.log("=== GeoJSON Polygon Fix ===\n");
console.log("Reading countries.topo.json...");

const topo = JSON.parse(readFileSync(TOPO_PATH, "utf-8"));
const objName = Object.keys(topo.objects)[0];
const fc = topojsonClient.feature(topo, topo.objects[objName]);

const geoJson = {
  type: "FeatureCollection",
  features: fc.features.map((f) => ({
    type: "Feature",
    id: f.properties?.id || f.id,
    properties: f.properties || {},
    geometry: f.geometry,
  })),
};

console.log(`  Converted ${geoJson.features.length} features`);

/* ── Step 2: Fix antimeridian-crossing edges ─────────────────────────── */

function fixCrossingEdge(p1, p2) {
  const lonDiff = Math.abs(p1[0] - p2[0]);
  if (lonDiff <= 180) return null;

  const lat1 = p1[1], lat2 = p2[1];
  const steps = Math.ceil(lonDiff / 90);
  const intermediates = [];

  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    intermediates.push([p1[0] + t * (p2[0] - p1[0]), lat1 + t * (lat2 - lat1)]);
  }

  return intermediates;
}

function fixRing(ring) {
  let fixed = false;
  const result = [];

  for (let i = 0; i < ring.length; i++) {
    result.push(ring[i]);
    if (i < ring.length - 1) {
      const intermediates = fixCrossingEdge(ring[i], ring[i + 1]);
      if (intermediates) {
        result.push(...intermediates);
        fixed = true;
      }
    }
  }

  return fixed ? result : null;
}

function fixGeometry(geom) {
  if (!geom || !geom.coordinates) return false;
  let changed = false;

  if (geom.type === "Polygon") {
    for (let r = 0; r < geom.coordinates.length; r++) {
      const fixed = fixRing(geom.coordinates[r]);
      if (fixed) { geom.coordinates[r] = fixed; changed = true; }
    }
  } else if (geom.type === "MultiPolygon") {
    for (let p = 0; p < geom.coordinates.length; p++) {
      for (let r = 0; r < geom.coordinates[p].length; r++) {
        const fixed = fixRing(geom.coordinates[p][r]);
        if (fixed) { geom.coordinates[p][r] = fixed; changed = true; }
      }
    }
  }

  return changed;
}

/* ── Step 3: Split wide polygons at meridians ────────────────────────── */

/**
 * Interpolate the latitude where a line segment crosses a given meridian.
 */
function crossingLat(p1, p2, meridian) {
  const t = (meridian - p1[0]) / (p2[0] - p1[0]);
  return p1[1] + t * (p2[1] - p1[1]);
}

/**
 * Split a single ring along a meridian (vertical line at the given lon).
 * Returns { left: ring[], right: ring[] } or null if no split needed.
 * left = lon < meridian, right = lon >= meridian.
 */
function splitRingAtMeridian(ring, meridian) {
  const leftSegments = [];
  const rightSegments = [];
  let current = [];

  for (let i = 0; i < ring.length - 1; i++) {
    const curr = ring[i];
    const next = ring[i + 1];
    current.push([...curr]);

    const currRight = curr[0] >= meridian;
    const nextRight = next[0] >= meridian;

    if (currRight !== nextRight) {
      const edgeSpan = Math.abs(curr[0] - next[0]);
      if (edgeSpan > 180) continue;

      const lat = crossingLat(curr, next, meridian);
      const crossPt = [meridian, lat];

      current.push([...crossPt]);

      if (currRight) {
        rightSegments.push(current);
      } else {
        leftSegments.push(current);
      }

      current = [[...crossPt]];
    }
  }

  if (current.length === 0) return null;

  const firstLon = ring[0][0];
  if (firstLon >= meridian) {
    if (rightSegments.length > 0) {
      rightSegments[0] = [...current, ...rightSegments[0]];
    } else {
      rightSegments.push(current);
    }
  } else {
    if (leftSegments.length > 0) {
      leftSegments[0] = [...current, ...leftSegments[0]];
    } else {
      leftSegments.push(current);
    }
  }

  function buildRing(segments) {
    if (segments.length === 0) return null;
    const coords = [];
    for (const seg of segments) coords.push(...seg);
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push([...first]);
    }
    return coords.length >= 4 ? coords : null;
  }

  const leftRing = buildRing(leftSegments);
  const rightRing = buildRing(rightSegments);

  if (!leftRing && !rightRing) return null;
  return { left: leftRing, right: rightRing };
}

/**
 * Recursively split a ring at multiple meridians until every piece
 * is narrower than MAX_LON_SPAN.
 */
function splitRingRecursive(ring) {
  const lons = ring.map((c) => c[0]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const span = maxLon - minLon;

  if (span <= MAX_LON_SPAN) return [ring];

  const meridian = (minLon + maxLon) / 2;
  const result = splitRingAtMeridian(ring, meridian);

  if (!result) return [ring];

  const pieces = [];
  if (result.left) pieces.push(...splitRingRecursive(result.left));
  if (result.right) pieces.push(...splitRingRecursive(result.right));
  return pieces;
}

/**
 * For MultiPolygon geometries, split any polygon whose outer ring is
 * wider than MAX_LON_SPAN.
 */
function splitWidePolygons(geom, featureId) {
  if (!geom || !geom.coordinates) return false;

  const isMulti = geom.type === "MultiPolygon";
  const isPoly = geom.type === "Polygon";
  if (!isMulti && !isPoly) return false;

  const inputPolygons = isMulti ? geom.coordinates : [geom.coordinates];
  const outputPolygons = [];
  let changed = false;

  for (const polygon of inputPolygons) {
    const outerRing = polygon[0];
    const lons = outerRing.map((c) => c[0]);
    const span = Math.max(...lons) - Math.min(...lons);

    if (span <= MAX_LON_SPAN) {
      outputPolygons.push(polygon);
      continue;
    }

    const pieces = splitRingRecursive(outerRing);
    const numPieces = pieces.length;
    console.log(`  Split ${featureId} polygon (${span.toFixed(0)}° span) → ${numPieces} pieces`);

    for (const piece of pieces) {
      outputPolygons.push([piece]);
    }
    changed = true;
  }

  if (changed) {
    geom.type = "MultiPolygon";
    geom.coordinates = outputPolygons;
  }
  return changed;
}

/* ── Step 4: Clamp ±180 longitudes ───────────────────────────────────── */

function clampCoordinates(geom) {
  let clamped = 0;
  function walk(coords) {
    if (typeof coords[0] === "number") {
      if (coords[0] >= 180) { coords[0] = 179.999; clamped++; }
      else if (coords[0] <= -180) { coords[0] = -179.999; clamped++; }
      return;
    }
    for (const c of coords) walk(c);
  }
  if (geom?.coordinates) walk(geom.coordinates);
  return clamped;
}

/* ── Apply all fixes ─────────────────────────────────────────────────── */

let fixedEdges = 0;
let splitCount = 0;
let totalClamped = 0;

for (const feature of geoJson.features) {
  const didFixEdges = fixGeometry(feature.geometry);
  if (didFixEdges) {
    console.log(`  Fixed crossing edges in: ${feature.id}`);
    fixedEdges++;
  }

  const didSplit = splitWidePolygons(feature.geometry, feature.id);
  if (didSplit) splitCount++;

  const clamped = clampCoordinates(feature.geometry);
  if (clamped > 0) {
    console.log(`  Clamped ${clamped} ±180 coords in: ${feature.id}`);
    totalClamped += clamped;
  }
}

/* ── Write result ────────────────────────────────────────────────────── */

writeFileSync(GEO_PATH, JSON.stringify(geoJson), "utf-8");
console.log(`\nDone: ${fixedEdges} edge fixes, ${splitCount} feature splits, ${totalClamped} coords clamped`);
console.log(`→ ${GEO_PATH}`);
