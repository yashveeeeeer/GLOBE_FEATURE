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

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/50fbe4fa-ba9a-46ba-9d26-eb9e995210d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'regionIndex.ts:loadRegionIndex',message:'fetch region_index starting',data:{path:'/data/region_index.json'},timestamp:Date.now(),hypothesisId:'B',runId:'run1'})}).catch(()=>{});
  // #endregion
  let res: Response;
  try {
    res = await fetch("/data/region_index.json");
  } catch (e) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/50fbe4fa-ba9a-46ba-9d26-eb9e995210d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'regionIndex.ts:loadRegionIndex',message:'fetch threw',data:{err: String(e), message: e instanceof Error ? e.message : ''},timestamp:Date.now(),hypothesisId:'B',runId:'run1'})}).catch(()=>{});
    // #endregion
    throw e;
  }
  if (!res.ok) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/50fbe4fa-ba9a-46ba-9d26-eb9e995210d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'regionIndex.ts:loadRegionIndex',message:'res not ok',data:{status:res.status, statusText:res.statusText},timestamp:Date.now(),hypothesisId:'B',runId:'run1'})}).catch(()=>{});
    // #endregion
    throw new Error(`Failed to load region index: ${res.status} ${res.statusText}`);
  }

  const raw = await res.json();
  _index = validateRegionIndex(raw) as RegionIndex;
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
