#!/usr/bin/env node
/**
 * Build-time data optimisation.
 *
 *  1. Splits region_index.json into:
 *     - region_index_boot.json  (countries + world only — ~50 KB)
 *     - region_index.json       (unchanged, lazy-loaded on drill-down)
 *
 *  2. Re-quantizes countries.topo.json with tighter quantization to
 *     shrink coordinate precision for the zoomed-out world view.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DATA_DIR = resolve("public/data");

/* ── 1. Split region index ────────────────────────────────────────────── */

const idxPath = resolve(DATA_DIR, "region_index.json");
const idx = JSON.parse(readFileSync(idxPath, "utf-8"));

const bootIndex = {};
for (const [id, entry] of Object.entries(idx)) {
  if (entry.level === "country" || entry.level === "world") {
    bootIndex[id] = entry;
  }
}

const bootPath = resolve(DATA_DIR, "region_index_boot.json");
writeFileSync(bootPath, JSON.stringify(bootIndex));

const bootSize = Math.round(JSON.stringify(bootIndex).length / 1024);
const fullSize = Math.round(readFileSync(idxPath, "utf-8").length / 1024);
console.log(`[optimizeData] region_index_boot.json: ${bootSize} KB (was ${fullSize} KB)`);

/* ── 2. Simplify countries TopoJSON ───────────────────────────────────── */

const topoPath = resolve(DATA_DIR, "countries.topo.json");
const topoRaw = readFileSync(topoPath, "utf-8");
const topo = JSON.parse(topoRaw);

let reduced = false;

if (topo.arcs) {
  let totalBefore = 0;
  let totalAfter = 0;

  for (let i = 0; i < topo.arcs.length; i++) {
    const arc = topo.arcs[i];
    totalBefore += arc.length;
    if (arc.length > 8) {
      const step = Math.max(2, Math.floor(arc.length / Math.ceil(arc.length / 4)));
      const simplified = [arc[0]];
      for (let j = step; j < arc.length - 1; j += step) {
        simplified.push(arc[j]);
      }
      simplified.push(arc[arc.length - 1]);
      topo.arcs[i] = simplified;
    }
    totalAfter += topo.arcs[i].length;
  }

  if (totalAfter < totalBefore) {
    reduced = true;
    const newJson = JSON.stringify(topo);
    writeFileSync(topoPath, newJson);
    const newSize = Math.round(newJson.length / 1024);
    const oldSize = Math.round(topoRaw.length / 1024);
    const pct = Math.round((1 - newSize / oldSize) * 100);
    console.log(`[optimizeData] countries.topo.json: ${newSize} KB (was ${oldSize} KB, -${pct}%)`);
    console.log(`[optimizeData]   arcs: ${totalBefore} points -> ${totalAfter} points`);
  }
}

if (!reduced) {
  console.log(`[optimizeData] countries.topo.json: no further simplification needed`);
}

console.log("[optimizeData] done");
