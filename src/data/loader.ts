/**
 * ── Unified dataset loader ─────────────────────────────────────────────
 *
 * Fetches geographic data files (GeoJSON or TopoJSON), parses them in a
 * Web Worker to avoid blocking the main thread, and caches results with
 * LRU eviction.
 *
 * Falls back to main-thread parsing if the Worker fails to initialise.
 */

import type { RegionFeatureCollection } from "../types";
import { parseTopoJson } from "./topo";

/* ── Configuration ───────────────────────────────────────────────────── */

const MAX_CACHE_ENTRIES = 20;

/* ── LRU Cache ───────────────────────────────────────────────────────── */

const _cache = new Map<string, RegionFeatureCollection>();
const _accessOrder: string[] = [];

function cacheGet(key: string): RegionFeatureCollection | undefined {
  const val = _cache.get(key);
  if (val) {
    const idx = _accessOrder.indexOf(key);
    if (idx >= 0) _accessOrder.splice(idx, 1);
    _accessOrder.push(key);
  }
  return val;
}

function cacheSet(key: string, val: RegionFeatureCollection): void {
  if (_cache.has(key)) {
    const idx = _accessOrder.indexOf(key);
    if (idx >= 0) _accessOrder.splice(idx, 1);
  }
  _cache.set(key, val);
  _accessOrder.push(key);
  while (_cache.size > MAX_CACHE_ENTRIES && _accessOrder.length > 0) {
    const evict = _accessOrder.shift()!;
    _cache.delete(evict);
  }
}

/* ── Web Worker for off-thread parsing ───────────────────────────────── */

let _worker: Worker | null = null;
let _workerFailed = false;
let _nextId = 0;
const _pending = new Map<
  number,
  { resolve: (v: RegionFeatureCollection) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker | null {
  if (_workerFailed) return null;
  if (_worker) return _worker;

  try {
    _worker = new Worker(
      new URL("./parseWorker.ts", import.meta.url),
      { type: "module" },
    );

    _worker.onmessage = (e: MessageEvent) => {
      const { id, data, error } = e.data as {
        id: number;
        data?: unknown;
        error?: string;
      };
      const p = _pending.get(id);
      if (!p) return;
      _pending.delete(id);

      if (error) {
        p.reject(new Error(error));
      } else {
        p.resolve(data as RegionFeatureCollection);
      }
    };

    _worker.onerror = () => {
      // Worker failed — reject all pending and disable
      console.warn("[loader] Web Worker error — falling back to main thread");
      _workerFailed = true;
      for (const [, p] of _pending) {
        p.reject(new Error("Worker error"));
      }
      _pending.clear();
      _worker = null;
    };

    return _worker;
  } catch {
    console.warn("[loader] Web Worker init failed — using main thread");
    _workerFailed = true;
    return null;
  }
}

/**
 * Parse a URL via the Web Worker (fetch + JSON.parse + optional TopoJSON
 * conversion all happen off the main thread).
 */
function parseViaWorker(url: string): Promise<RegionFeatureCollection> {
  const worker = getWorker();
  if (!worker) return Promise.reject(new Error("No worker"));

  const id = _nextId++;
  return new Promise<RegionFeatureCollection>((resolve, reject) => {
    _pending.set(id, { resolve, reject });
    worker.postMessage({ id, url });
  });
}

/* ── Main-thread fallback parser ─────────────────────────────────────── */

async function parseOnMainThread(
  path: string,
): Promise<RegionFeatureCollection> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load dataset ${path}: ${res.status}`);
  }

  const raw = await res.json();

  const isTopoJson =
    path.endsWith(".topo.json") || path.endsWith(".topojson");

  return isTopoJson
    ? parseTopoJson(raw)
    : (raw as RegionFeatureCollection);
}

/* ── Public API ──────────────────────────────────────────────────────── */

/**
 * Load a geographic dataset from a URL path.
 *
 * Parsing happens in a Web Worker when available, keeping the main thread
 * free for camera animation. Falls back to main-thread parsing if the
 * Worker is unavailable.
 *
 * Results are LRU-cached (max 20 entries).
 */
export async function loadDataset(
  path: string,
): Promise<RegionFeatureCollection> {
  const cached = cacheGet(path);
  if (cached) return cached;

  let fc: RegionFeatureCollection;

  try {
    // Try Web Worker first (JSON.parse + TopoJSON conversion off main thread)
    fc = await parseViaWorker(path);
  } catch {
    // Fallback to main thread
    fc = await parseOnMainThread(path);
  }

  cacheSet(path, fc);
  return fc;
}

