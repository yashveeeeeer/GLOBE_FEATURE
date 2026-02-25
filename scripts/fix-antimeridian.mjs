#!/usr/bin/env node
/**
 * fix-antimeridian.mjs
 *
 * Re-generates countries.geo.json from the cleaned countries.topo.json,
 * then fixes CesiumJS rendering artifacts caused by polygon edges that
 * cross the antimeridian (|Δlon| > 180°).
 *
 * Strategy:
 *  1. Convert countries.topo.json → GeoJSON (fresh, unmodified source)
 *  2. For edges that cross the antimeridian, insert intermediate vertices
 *     so no single edge spans > 180° of longitude
 *  3. Clamp ±180.0 longitudes to ±179.999 (CesiumJS boundary edge-case)
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

/* ── Step 1: Convert TopoJSON → GeoJSON ──────────────────────────────── */

console.log("=== Antimeridian Fix ===\n");
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

/**
 * For a single edge spanning > 180° of longitude, compute intermediate
 * points that break it into shorter segments. Each intermediate is a
 * linear interpolation along the edge at evenly spaced longitudes.
 */
function fixCrossingEdge(p1, p2) {
  const lonDiff = Math.abs(p1[0] - p2[0]);
  if (lonDiff <= 180) return null;

  // At the pole (|lat| ≈ 90), all longitudes converge to the same point.
  // Insert intermediates at 90° intervals along the same latitude.
  const lat1 = p1[1], lat2 = p2[1];
  const steps = Math.ceil(lonDiff / 90);
  const intermediates = [];

  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const lon = p1[0] + t * (p2[0] - p1[0]);
    const lat = lat1 + t * (lat2 - lat1);
    intermediates.push([lon, lat]);
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

/* ── Step 3: Clamp ±180 longitudes ───────────────────────────────────── */

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

/* ── Apply fixes ─────────────────────────────────────────────────────── */

let fixedCount = 0;
let totalClamped = 0;

for (const feature of geoJson.features) {
  const didFix = fixGeometry(feature.geometry);
  if (didFix) {
    console.log(`  Fixed crossing edges in: ${feature.id}`);
    fixedCount++;
  }

  const clamped = clampCoordinates(feature.geometry);
  if (clamped > 0) {
    console.log(`  Clamped ${clamped} ±180 coords in: ${feature.id}`);
    totalClamped += clamped;
  }
}

/* ── Write result ────────────────────────────────────────────────────── */

writeFileSync(GEO_PATH, JSON.stringify(geoJson), "utf-8");
console.log(`\nDone: ${fixedCount} features fixed, ${totalClamped} coordinates clamped`);
console.log(`→ ${GEO_PATH}`);
