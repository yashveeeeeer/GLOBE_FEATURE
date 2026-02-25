#!/usr/bin/env node
/**
 * fix-antimeridian.mjs
 *
 * Re-generates countries.geo.json from countries.topo.json with minimal
 * data fixes for coordinate edge-cases:
 *
 *  1. Convert countries.topo.json → GeoJSON (fresh, unmodified source)
 *  2. For edges that cross the antimeridian (|Δlon| > 180°), insert
 *     intermediate vertices so no single edge wraps the globe
 *  3. Clamp ±180.0 longitudes to ±179.999 (renderer boundary edge-case)
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

console.log("=== GeoJSON Fix ===\n");
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

let fixedEdges = 0;
let totalClamped = 0;

for (const feature of geoJson.features) {
  const didFix = fixGeometry(feature.geometry);
  if (didFix) {
    console.log(`  Fixed crossing edges in: ${feature.id}`);
    fixedEdges++;
  }

  const clamped = clampCoordinates(feature.geometry);
  if (clamped > 0) {
    console.log(`  Clamped ${clamped} ±180 coords in: ${feature.id}`);
    totalClamped += clamped;
  }
}

/* ── Write result ────────────────────────────────────────────────────── */

writeFileSync(GEO_PATH, JSON.stringify(geoJson), "utf-8");
console.log(`\nDone: ${fixedEdges} edge fixes, ${totalClamped} coords clamped`);
console.log(`→ ${GEO_PATH}`);
