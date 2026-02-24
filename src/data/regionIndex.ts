/**
 * ── Region Index loader + accessors ────────────────────────────────────
 *
 * Fetches the region index JSON and provides typed accessors.
 * GeoJSON/TopoJSON dataset loading is handled by loader.ts.
 */

import type { RegionIndex, RegionIndexEntry, SelectionLevel } from "../types";
import { validateRegionIndex } from "./schema";

/* ── In-memory cache ─────────────────────────────────────────────────── */

let _index: RegionIndex | null = null;

/* ── Index loading ───────────────────────────────────────────────────── */

/**
 * Load and cache the region index. Safe to call multiple times.
 */
export async function loadRegionIndex(): Promise<RegionIndex> {
  if (_index) return _index;

  const url = `${import.meta.env.BASE_URL}data/region_index.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load region index: ${res.status} ${res.statusText}`);
  }

  const raw = await res.json();
  _index = validateRegionIndex(raw) as RegionIndex;

  // Rewrite childDatasetPath entries to include the base URL so fetches
  // work on both localhost and subpath deployments (e.g. GitHub Pages).
  const base = import.meta.env.BASE_URL;
  for (const entry of Object.values(_index)) {
    if (entry.childDatasetPath?.startsWith("/")) {
      entry.childDatasetPath = `${base}${entry.childDatasetPath.slice(1)}`;
    }
  }

  return _index;
}

/** Synchronous accessor — null if not yet loaded. */
export function getRegionIndex(): RegionIndex | null {
  return _index;
}

/** Get a single entry by ID. */
export function getRegionEntry(id: string): RegionIndexEntry | undefined {
  return _index?.[id];
}

/**
 * Return entries of a given level, optionally filtered by parentId.
 * Sorted alphabetically by name.
 */
export function getRegionsByLevel(
  level: SelectionLevel,
  parentId?: string | null,
): Array<[id: string, entry: RegionIndexEntry]> {
  if (!_index) return [];
  return Object.entries(_index)
    .filter(([, entry]) => {
      if (entry.level !== level) return false;
      if (parentId !== undefined && entry.parentId !== parentId) return false;
      return true;
    })
    .sort(([, a], [, b]) => a.name.localeCompare(b.name));
}
