/** ── Shared type definitions for the Globe Drilldown app ────────────── */

/**
 * Hierarchical level in the drill-down tree.
 */
export type SelectionLevel = "world" | "country" | "subregion";

/**
 * Bounding box as [west, south, east, north] in decimal degrees.
 */
export type BBox = [west: number, south: number, east: number, north: number];

/**
 * Centroid as [longitude, latitude] in decimal degrees.
 */
export type Centroid = [lon: number, lat: number];

/**
 * A single entry in the region index.
 */
export interface RegionIndexEntry {
  name: string;
  level: SelectionLevel;
  parentId: string | null;
  bbox: BBox;
  centroid: Centroid;
  childDatasetPath: string | null;
  /** Total polygon vertices (computed at build time) */
  vertexCount?: number;
  /** Shape area in sq-degrees (from raw data) */
  area?: number;
  /** Zoom hint scalar 1-10, derived from log(area) */
  zoomHint?: number;
}

/**
 * The full region index map: `{ [regionId]: RegionIndexEntry }`.
 */
export type RegionIndex = Record<string, RegionIndexEntry>;

/* ── GeoJSON types (minimal, avoids @types/geojson dep) ──────────────── */

export interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
  geometries?: GeoJsonGeometry[];
}

export interface RegionFeatureProperties {
  id: string;
  name: string;
  parentId?: string;
}

export interface RegionFeature {
  type: "Feature";
  id: string;
  properties: RegionFeatureProperties;
  geometry: GeoJsonGeometry;
}

export interface RegionFeatureCollection {
  type: "FeatureCollection";
  features: RegionFeature[];
}

/* ── Focus options ───────────────────────────────────────────────────── */

export interface FocusOptions {
  duration?: number;
  padding?: number; // 0–1, default 0.1
  mode?: "bbox" | "sphere" | "auto";
}
