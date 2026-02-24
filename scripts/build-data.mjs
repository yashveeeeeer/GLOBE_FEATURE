#!/usr/bin/env node
/**
 * build-data.mjs  —  Globe Drilldown data pipeline
 *
 * Converts raw Commenda TopoJSON into the app's expected format:
 *
 *   public/data/
 *   ├── region_index.json           ← metadata + bbox/centroid/area/vertexCount/zoomHint
 *   ├── countries.topo.json         ← cleaned adm0 TopoJSON (served to browser)
 *   └── subregions/
 *       ├── {countryId}.geo.json    ← adm1 per-country GeoJSON (topology-simplified)
 *       └── ...
 *
 * Usage:  node scripts/build-data.mjs       (or: npm run data:build)
 *
 * Input files (expected in project root):
 *   - world_adm0_commenda.topojson
 *   - world_adm1_commenda.topojson
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { presimplify, simplify, quantile } from "topojson-simplify";
import * as topojsonClient from "topojson-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public", "data");

/* ══════════════════════════════════════════════════════════════════════
   TopoJSON → GeoJSON decoder (inline, zero external deps besides
   topojson-simplify which operates on the topology before this step)
   ══════════════════════════════════════════════════════════════════════ */

function topoToGeoJSON(topology, objectName) {
  const obj = topology.objects[objectName];
  if (!obj) throw new Error(`Object "${objectName}" not found. Available: ${Object.keys(topology.objects)}`);
  return {
    type: "FeatureCollection",
    features: obj.geometries.map((geom) => ({
      type: "Feature",
      id: geom.id,
      properties: geom.properties || {},
      geometry: decodeGeometry(topology, geom),
    })),
  };
}

function decodeGeometry(topology, geom) {
  if (geom.type === "GeometryCollection")
    return { type: "GeometryCollection", geometries: geom.geometries.map((g) => decodeGeometry(topology, g)) };
  if (!geom.arcs) return { type: geom.type, coordinates: geom.coordinates || [] };

  const { transform, arcs } = topology;

  function decodeArc(idx) {
    const arc = arcs[idx < 0 ? ~idx : idx];
    const out = [];
    let x = 0, y = 0;
    for (const [dx, dy] of arc) {
      x += dx; y += dy;
      out.push(transform ? [x * transform.scale[0] + transform.translate[0], y * transform.scale[1] + transform.translate[1]] : [x, y]);
    }
    if (idx < 0) out.reverse();
    return out;
  }

  function decodeRing(ring) {
    const coords = [];
    for (const arcIdx of ring) {
      const d = decodeArc(arcIdx);
      const start = coords.length > 0 ? 1 : 0;
      for (let i = start; i < d.length; i++) coords.push(d[i]);
    }
    return coords;
  }

  switch (geom.type) {
    case "Point": return { type: "Point", coordinates: decodePoint(topology, geom.coordinates) };
    case "MultiPoint": return { type: "MultiPoint", coordinates: geom.coordinates.map((c) => decodePoint(topology, c)) };
    case "LineString": return { type: "LineString", coordinates: decodeRing(geom.arcs) };
    case "MultiLineString": return { type: "MultiLineString", coordinates: geom.arcs.map(decodeRing) };
    case "Polygon": return { type: "Polygon", coordinates: geom.arcs.map(decodeRing) };
    case "MultiPolygon": return { type: "MultiPolygon", coordinates: geom.arcs.map((p) => p.map(decodeRing)) };
    default: return { type: geom.type, coordinates: [] };
  }
}

function decodePoint(topology, coords) {
  const { transform: t } = topology;
  return t ? [coords[0] * t.scale[0] + t.translate[0], coords[1] * t.scale[1] + t.translate[1]] : coords;
}

/* ══════════════════════════════════════════════════════════════════════
   Geometry metric helpers
   ══════════════════════════════════════════════════════════════════════ */

function computeBBox(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function walk(c) {
    if (typeof c[0] === "number") { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); return; }
    for (const cc of c) walk(cc);
  }
  if (geometry.type === "GeometryCollection") { for (const g of geometry.geometries) { const b = computeBBox(g); minX = Math.min(minX, b[0]); minY = Math.min(minY, b[1]); maxX = Math.max(maxX, b[2]); maxY = Math.max(maxY, b[3]); } }
  else walk(geometry.coordinates);
  return [r3(minX), r3(minY), r3(maxX), r3(maxY)];
}

function computeCentroid(bbox) {
  return [r3((bbox[0] + bbox[2]) / 2), r3((bbox[1] + bbox[3]) / 2)];
}

function countVertices(geometry) {
  let count = 0;
  function walk(c) { if (typeof c[0] === "number") { count++; return; } for (const cc of c) walk(cc); }
  if (geometry.type === "GeometryCollection") for (const g of geometry.geometries) count += countVertices(g);
  else if (geometry.coordinates) walk(geometry.coordinates);
  return count;
}

function computeZoomHint(area) {
  if (!area || area <= 0) return 1;
  const raw = Math.log10(area + 0.001);
  return Math.max(1, Math.min(10, Math.round(((raw + 3) / 6) * 9 + 1)));
}

function r3(n) { return Math.round(n * 1000) / 1000; }

/* ══════════════════════════════════════════════════════════════════════
   Topology-preserving simplification (via topojson-simplify)

   Simplifies SHARED ARCS in TopoJSON space so adjacent polygons keep
   identical border vertices. No gaps, no overlaps, no doubled lines.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Simplify a TopoJSON topology using a fixed minWeight threshold.
 *
 * minWeight is the minimum triangle-area significance for a vertex
 * to survive. Larger = more aggressive.
 *   1e-4 ≈ ~10 km² at equator (moderate)
 *   1e-3 ≈ ~100 km² at equator (aggressive)
 *   1e-2 ≈ ~1000 km² at equator (very aggressive)
 */
function simplifyTopology(topo, minWeight = 1e-4) {
  console.log(`    presimplify...`);
  const pre = presimplify(topo);
  console.log(`    simplify with minWeight=${minWeight.toExponential(2)}...`);
  return simplify(pre, minWeight);
}

/* ══════════════════════════════════════════════════════════════════════
   Antimeridian overrides (applied at end)
   ══════════════════════════════════════════════════════════════════════ */

const ANTIMERIDIAN_OVERRIDES = {
  US: { centroid: [-98.5, 39.8], bbox: [-125.0, 24.5, -66.9, 49.4] },
  RU: { centroid: [90.0, 62.0], bbox: [27.0, 41.2, 180.0, 81.9] },
  NZ: { centroid: [173.0, -41.3], bbox: [166.4, -47.3, 178.6, -34.4] },
  KI: { centroid: [173.0, 1.4], bbox: [169.5, -3.4, 177.0, 4.0] },
  FJ: { centroid: [178.0, -17.8], bbox: [176.9, -21.7, 180.0, -12.5] },
  AQ: { centroid: [0.0, -82.0] },
};

/* ══════════════════════════════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════════════════════════════ */

console.log("=== Globe Drilldown — Data Builder ===\n");
mkdirSync(join(OUT, "subregions"), { recursive: true });

// ── 1. ADM0 (countries) ───────────────────────────────────────────────
const adm0Path = join(ROOT, "world_adm0_commenda.topojson");
if (!existsSync(adm0Path)) { console.error("ERROR: world_adm0_commenda.topojson not found."); process.exit(1); }

console.log("Loading adm0 (countries)...");
const adm0Topo = JSON.parse(readFileSync(adm0Path, "utf-8"));
const obj0 = Object.keys(adm0Topo.objects)[0];
console.log(`  object: "${obj0}", ${adm0Topo.objects[obj0].geometries.length} geometries`);

// Topology-preserving simplification on adm0
console.log("  Simplifying adm0 topology...");
const simplifiedAdm0 = simplifyTopology(adm0Topo, 1e-5);

// Convert simplified topology to GeoJSON using topojson-client (handles undefined coords)
const countriesFC = topojsonClient.feature(simplifiedAdm0, simplifiedAdm0.objects[obj0]);
const countriesGeo = { type: "FeatureCollection", features: countriesFC.features.map(f => ({ type: "Feature", id: f.id, properties: f.properties || {}, geometry: f.geometry })) };

// Group by country_id to merge duplicates (IN=India+Siachen, AU=Australia+territories, etc.)
const regionIndex = {};
const countryGroups = new Map();
for (const f of countriesGeo.features) {
  const p = f.properties;
  const id = p.country_id || p.commenda_jurisdiction_id || `UNK_${f.id}`;
  const name = p.country_name || p.NAME || id;
  f.id = id;
  f.properties = { id, name, shapeArea: p.Shape_Area || 0 };
  if (!countryGroups.has(id)) countryGroups.set(id, []);
  countryGroups.get(id).push(f);
}

const mergedFeatures = [];
for (const [id, feats] of countryGroups) {
  feats.sort((a, b) => (b.properties.shapeArea || 0) - (a.properties.shapeArea || 0));
  const primary = feats[0];
  const name = primary.properties.name;
  const area = primary.properties.shapeArea || 0;

  if (feats.length > 1)
    console.log(`  Merging ${feats.length} geometries for ${id} (${name})`);

  const bbox = computeBBox(primary.geometry);
  const centroid = computeCentroid(bbox);
  let verts = 0;
  for (const f of feats) {
    f.properties = { id, name };
    verts += countVertices(f.geometry);
    mergedFeatures.push(f);
  }

  regionIndex[id] = {
    name,
    level: "country",
    parentId: null,
    bbox,
    centroid,
    childDatasetPath: `/data/subregions/${id}.geo.json`,
    vertexCount: verts,
    area: r3(area),
    zoomHint: computeZoomHint(area),
  };
}

countriesGeo.features = mergedFeatures;
console.log(`  ${countryGroups.size} countries (${mergedFeatures.length} features)`);

// Write cleaned + simplified countries TopoJSON
const cleanedTopo = JSON.parse(JSON.stringify(simplifiedAdm0));
const cGeoms = cleanedTopo.objects[obj0].geometries;
for (const g of cGeoms) {
  const p = g.properties;
  const id = p.country_id || p.commenda_jurisdiction_id || `UNK_${g.id}`;
  const name = p.country_name || p.NAME || id;
  g.properties = { id, name };
}
writeFileSync(join(OUT, "countries.topo.json"), JSON.stringify(cleanedTopo), "utf-8");
console.log("  → public/data/countries.topo.json");

// Also write GeoJSON
writeFileSync(join(OUT, "countries.geo.json"), JSON.stringify(countriesGeo), "utf-8");
console.log("  → public/data/countries.geo.json");

// ── 2. ADM1 (subregions) ─────────────────────────────────────────────
const adm1Path = join(ROOT, "world_adm1_commenda.topojson");
if (!existsSync(adm1Path)) { console.error("ERROR: world_adm1_commenda.topojson not found."); process.exit(1); }

console.log("\nLoading adm1 (subregions)...");
const adm1Topo = JSON.parse(readFileSync(adm1Path, "utf-8"));
const obj1 = Object.keys(adm1Topo.objects)[0];
console.log(`  object: "${obj1}", ${adm1Topo.objects[obj1].geometries.length} geometries`);

// Topology-preserving simplification on adm1 — shared borders stay identical
console.log("  Simplifying adm1 topology (this may take a moment)...");
const simplifiedAdm1 = simplifyTopology(adm1Topo, 1e-4);

// Convert simplified topology to GeoJSON using topojson-client (handles undefined coords)
const subFC = topojsonClient.feature(simplifiedAdm1, simplifiedAdm1.objects[obj1]);
const subGeo = { type: "FeatureCollection", features: subFC.features.map(f => ({ type: "Feature", id: f.id, properties: f.properties || {}, geometry: f.geometry })) };
const byCountry = new Map();

// Count total vertices for reporting
let totalVertsOriginal = 0;
{
  const origFC = topojsonClient.feature(adm1Topo, adm1Topo.objects[obj1]);
  for (const f of origFC.features) totalVertsOriginal += countVertices(f.geometry);
}
let totalVertsSimplified = 0;

for (const f of subGeo.features) {
  const p = f.properties;
  const countryId = p.country_id || p.ISO_CC || "UNKNOWN";
  const stateId = p.state_id || p.ISO_SUB || p.NAME || `SUB_${f.id}`;
  const regionId = p.commenda_jurisdiction_id || `${countryId}_${stateId}`;
  const name = p.state_name || p.NAME || stateId;
  const area = p.Shape_Area || 0;

  f.id = regionId;
  f.properties = { id: regionId, name, parentId: countryId };

  if (!byCountry.has(countryId)) byCountry.set(countryId, []);
  byCountry.get(countryId).push(f);

  const bbox = computeBBox(f.geometry);
  const verts = countVertices(f.geometry);
  totalVertsSimplified += verts;

  regionIndex[regionId] = {
    name,
    level: "subregion",
    parentId: countryId,
    bbox,
    centroid: computeCentroid(bbox),
    childDatasetPath: null,
    vertexCount: verts,
    area: r3(area),
    zoomHint: computeZoomHint(area),
  };
}

const pct = totalVertsOriginal > 0 ? Math.round((1 - totalVertsSimplified / totalVertsOriginal) * 100) : 0;
console.log(`  ${subGeo.features.length} subregions across ${byCountry.size} countries`);
console.log(`  Topology-simplified: ${totalVertsOriginal} → ${totalVertsSimplified} vertices (${pct}% reduction)`);

let written = 0;
for (const [cid, feats] of byCountry) {
  writeFileSync(join(OUT, "subregions", `${cid}.geo.json`), JSON.stringify({ type: "FeatureCollection", features: feats }), "utf-8");
  written++;
}
console.log(`  → public/data/subregions/ (${written} files)`);

// Remove childDatasetPath for countries with no subregion data
for (const [id, entry] of Object.entries(regionIndex)) {
  if (entry.level === "country" && !byCountry.has(id)) entry.childDatasetPath = null;
}

// ── 3. Antimeridian overrides ─────────────────────────────────────────
for (const [id, overrides] of Object.entries(ANTIMERIDIAN_OVERRIDES)) {
  if (regionIndex[id]) Object.assign(regionIndex[id], overrides);
}
console.log(`  Applied antimeridian overrides for: ${Object.keys(ANTIMERIDIAN_OVERRIDES).join(", ")}`);

// ── 4. Write region index ─────────────────────────────────────────────
writeFileSync(join(OUT, "region_index.json"), JSON.stringify(regionIndex, null, 2), "utf-8");
console.log(`\n  → public/data/region_index.json (${Object.keys(regionIndex).length} entries)`);
console.log("\n✅ Done!");
