/**
 * ── Parse Worker ───────────────────────────────────────────────────────
 *
 * Web Worker that fetches a URL, parses the JSON, and optionally converts
 * TopoJSON → GeoJSON — all off the main thread so the globe keeps
 * rendering during heavy parsing.
 *
 * Communication protocol:
 *   Main → Worker:  { id: number, url: string }
 *   Worker → Main:  { id: number, data: object } | { id: number, error: string }
 */

import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

/** Normalize a single feature from topojson output. */
function normalizeFeature(f: Record<string, unknown>) {
  const props = (f.properties || {}) as Record<string, unknown>;
  const id = String(props.id ?? f.id ?? "");
  const name = String(props.name ?? props.NAME ?? id);
  return {
    type: "Feature",
    id,
    properties: {
      id,
      name,
      ...(props.parentId ? { parentId: String(props.parentId) } : {}),
    },
    geometry: f.geometry,
  };
}

/** Convert a TopoJSON topology to a GeoJSON FeatureCollection. */
function topoToGeoJSON(raw: unknown) {
  const topo = raw as Topology;
  if (!topo?.objects) throw new Error("Invalid TopoJSON");
  const names = Object.keys(topo.objects);
  if (names.length === 0) throw new Error("TopoJSON has no objects");

  const obj = topo.objects[names[0]!] as GeometryCollection;
  const fc = topojson.feature(topo, obj);

  const features =
    fc.type === "FeatureCollection"
      ? fc.features.map((f) => normalizeFeature(f as never))
      : [normalizeFeature(fc as never)];

  return { type: "FeatureCollection", features };
}

/* ── Worker message handler ──────────────────────────────────────────── */

self.onmessage = async (e: MessageEvent<{ id: number; url: string }>) => {
  const { id, url } = e.data;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Parse JSON off the main thread — this is the expensive part
    const text = await res.text();
    const raw = JSON.parse(text);

    // Convert TopoJSON if needed
    const isTopoJson =
      url.endsWith(".topo.json") || url.endsWith(".topojson");
    const data = isTopoJson ? topoToGeoJSON(raw) : raw;

    self.postMessage({ id, data });
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
