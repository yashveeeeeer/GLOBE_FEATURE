#!/usr/bin/env node
/**
 * fix-antimeridian.mjs
 *
 * Re-generates countries.geo.json from the cleaned countries.topo.json,
 * then fixes CesiumJS rendering artifacts:
 *
 *  1. Convert countries.topo.json → GeoJSON (fresh, unmodified source)
 *  2. For edges that cross the antimeridian, insert intermediate vertices
 *     so no single edge spans > 180° of longitude
 *  3. Split any polygon spanning > 300° lon at the prime meridian (0°)
 *     into eastern/western halves (fixes Antarctica triangulation)
 *  4. Clamp ±180.0 longitudes to ±179.999 (CesiumJS boundary edge-case)
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

console.log("=== Antimeridian & Pole Fix ===\n");
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

/* ── Step 3: Split wide polygons at the prime meridian (0° lon) ──────── */

/**
 * Split a polygon ring that spans >300° of longitude into eastern (lon>=0)
 * and western (lon<0) halves at the prime meridian.
 *
 * Returns { east: ring, west: ring } or null if no split needed.
 */
function splitRingAtPrimeMeridian(ring) {
  const lons = ring.map((c) => c[0]);
  const lonRange = Math.max(...lons) - Math.min(...lons);
  if (lonRange < 300) return null;

  const eastSegments = [];
  const westSegments = [];
  let current = [];

  for (let i = 0; i < ring.length - 1; i++) {
    const curr = ring[i];
    const next = ring[i + 1];
    current.push([...curr]);

    const oppositeSides =
      (curr[0] >= 0 && next[0] < 0) || (curr[0] < 0 && next[0] >= 0);

    if (oppositeSides && Math.abs(curr[0] - next[0]) < 180) {
      const t = (0 - curr[0]) / (next[0] - curr[0]);
      const lat = curr[1] + t * (next[1] - curr[1]);
      const crossPt = [0, lat];

      current.push([...crossPt]);

      if (curr[0] >= 0) {
        eastSegments.push(current);
      } else {
        westSegments.push(current);
      }

      current = [[...crossPt]];
    }
  }

  if (current.length === 0) return null;

  const firstLon = ring[0][0];
  if (firstLon >= 0) {
    if (eastSegments.length > 0) {
      eastSegments[0] = [...current, ...eastSegments[0]];
    } else {
      eastSegments.push(current);
    }
  } else {
    if (westSegments.length > 0) {
      westSegments[0] = [...current, ...westSegments[0]];
    } else {
      westSegments.push(current);
    }
  }

  function buildClosedRing(segments) {
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

  const eastRing = buildClosedRing(eastSegments);
  const westRing = buildClosedRing(westSegments);

  if (!eastRing && !westRing) return null;
  return { east: eastRing, west: westRing };
}

function splitWidePolygons(geom, featureId) {
  if (!geom || geom.type !== "MultiPolygon") return false;
  let changed = false;

  const newCoords = [];
  for (let p = 0; p < geom.coordinates.length; p++) {
    const outerRing = geom.coordinates[p][0];
    const result = splitRingAtPrimeMeridian(outerRing);

    if (result) {
      const lons = outerRing.map((c) => c[0]);
      const range = (Math.max(...lons) - Math.min(...lons)).toFixed(0);
      console.log(`  Split ${featureId} poly ${p} (${range}° span) → east + west halves`);

      if (result.east) newCoords.push([result.east]);
      if (result.west) newCoords.push([result.west]);
      changed = true;
    } else {
      newCoords.push(geom.coordinates[p]);
    }
  }

  if (changed) geom.coordinates = newCoords;
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
  const didFix = fixGeometry(feature.geometry);
  if (didFix) {
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
console.log(`\nDone: ${fixedEdges} edge fixes, ${splitCount} polygon splits, ${totalClamped} coordinates clamped`);
console.log(`→ ${GEO_PATH}`);
