/**
 * ── TopoJSON → GeoJSON parser ──────────────────────────────────────────
 *
 * Uses `topojson-client` to convert a TopoJSON Topology into a
 * RegionFeatureCollection that the rest of the app can consume.
 */

import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { RegionFeatureCollection, RegionFeature } from "../types";

/**
 * Parse a TopoJSON topology into a RegionFeatureCollection.
 *
 * Automatically picks the first (or only) object in the topology.
 * Each feature is normalized to have `id` and `properties.id/name`.
 */
export function parseTopoJson(raw: unknown): RegionFeatureCollection {
  const topo = raw as Topology;
  if (!topo || !topo.objects) {
    throw new Error("Invalid TopoJSON: missing 'objects'");
  }

  const objectNames = Object.keys(topo.objects);
  if (objectNames.length === 0) {
    throw new Error("TopoJSON has no objects");
  }

  const objectName = objectNames[0]!;
  const obj = topo.objects[objectName] as GeometryCollection;

  const fc = topojson.feature(topo, obj);

  // topojson.feature returns FeatureCollection or single Feature
  const features: RegionFeature[] = [];

  if (fc.type === "FeatureCollection") {
    for (const f of fc.features) {
      features.push(normalizeFeature(f as unknown as Record<string, unknown>));
    }
  } else {
    features.push(normalizeFeature(fc as never));
  }

  return { type: "FeatureCollection", features };
}

/** Ensure every feature has our expected properties shape. */
function normalizeFeature(f: Record<string, unknown>): RegionFeature {
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
    geometry: f.geometry as RegionFeature["geometry"],
  };
}
