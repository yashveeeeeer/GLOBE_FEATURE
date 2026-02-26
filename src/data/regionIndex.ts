/**
 * ── Region Index loader + accessors ────────────────────────────────────
 *
 * Two-phase loading for fast boot:
 *   1. Boot  — fetches region_index_boot.json (countries only, ~50 KB)
 *   2. Full  — fetches region_index.json lazily on first drill-down
 */

import type { RegionIndex, RegionIndexEntry, SelectionLevel } from "../types";
import { validateRegionIndex } from "./schema";

/* ── In-memory cache ─────────────────────────────────────────────────── */

let _index: RegionIndex | null = null;
let _fullLoaded = false;
let _fullPromise: Promise<RegionIndex> | null = null;

/* ── Helpers ──────────────────────────────────────────────────────────── */

function rewritePaths(index: RegionIndex): void {
  const base = import.meta.env.BASE_URL;
  for (const entry of Object.values(index)) {
    if (entry.childDatasetPath?.startsWith("/")) {
      entry.childDatasetPath = `${base}${entry.childDatasetPath.slice(1)}`;
    }
  }
}

async function fetchIndex(filename: string): Promise<RegionIndex> {
  const url = `${import.meta.env.BASE_URL}data/${filename}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${filename}: ${res.status} ${res.statusText}`);
  }
  const raw = await res.json();
  return validateRegionIndex(raw) as RegionIndex;
}

/* ── Public API ───────────────────────────────────────────────────────── */

/**
 * Fast boot load — countries-only index (~50 KB vs ~1.2 MB).
 */
export async function loadRegionIndex(): Promise<RegionIndex> {
  if (_index) return _index;
  _index = await fetchIndex("region_index_boot.json");
  rewritePaths(_index);
  return _index;
}

/**
 * Ensure the full index (including subregions) is loaded.
 * Called lazily when the user first drills into a country.
 */
export async function ensureFullIndex(): Promise<RegionIndex> {
  if (_fullLoaded && _index) return _index;

  if (!_fullPromise) {
    _fullPromise = fetchIndex("region_index.json").then((full) => {
      rewritePaths(full);
      if (_index) {
        Object.assign(_index, full);
      } else {
        _index = full;
      }
      _fullLoaded = true;
      return _index!;
    });
  }

  return _fullPromise;
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
