/**
 * ── useGlobeBoot ────────────────────────────────────────────────────────
 *
 * Async boot sequence: loads region index, countries TopoJSON, and nexus
 * data **in parallel**, then wires them into the Cesium viewer.
 */

import { useState, useCallback, useEffect, type RefObject } from "react";
import type { Viewer as CesiumViewer } from "cesium";

import { loadRegionIndex, getRegionEntry } from "../data/regionIndex";
import { loadDataset, prefetchDataset } from "../data/loader";
import { validateNexusData } from "../data/schema";
import {
  alive,
  LayerManager,
  setFocusGeometry,
  enableAutoRotate,
} from "../globe";
import { useNexusStore } from "../state/nexusStore";
import type { RegionFeatureCollection, NexusDataFile } from "../types";

interface UseGlobeBootArgs {
  viewerRef: RefObject<CesiumViewer | null>;
  layersRef: RefObject<LayerManager | null>;
  countriesRef: RefObject<RegionFeatureCollection | null>;
  ensureViewer: () => void;
}

async function fetchNexus(base: string): Promise<NexusDataFile | null> {
  try {
    const res = await fetch(`${base}data/nexus_exposure.json`);
    if (!res.ok) return null;
    const raw = await res.json();
    return validateNexusData(raw) as NexusDataFile;
  } catch {
    console.warn("[boot] Nexus data not available, skipping color overlay");
    return null;
  }
}

export interface BootStatus {
  regionIndex: boolean;
  geoData: boolean;
  nexusData: boolean;
}

export function useGlobeBoot({
  viewerRef,
  layersRef,
  countriesRef,
  ensureViewer,
}: UseGlobeBootArgs) {
  const [dataVersion, setDataVersion] = useState(0);
  const [globeReady, setGlobeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootStatus, setBootStatus] = useState<BootStatus>({
    regionIndex: false,
    geoData: false,
    nexusData: false,
  });
  const loadNexusFile = useNexusStore((s) => s.loadNexusFile);

  const boot = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      setGlobeReady(false);
      setBootStatus({ regionIndex: false, geoData: false, nexusData: false });

      ensureViewer();

      const base = import.meta.env.BASE_URL;

      const regionIndexP = loadRegionIndex().then((v) => {
        setBootStatus((s) => ({ ...s, regionIndex: true }));
        return v;
      });
      const geoP = loadDataset(`${base}data/countries.topo.json`).then((v) => {
        setBootStatus((s) => ({ ...s, geoData: true }));
        return v;
      });
      const nexusP = fetchNexus(base).then((v) => {
        setBootStatus((s) => ({ ...s, nexusData: true }));
        return v;
      });

      const [, geo, nexusFile] = await Promise.all([regionIndexP, geoP, nexusP]);

      if (signal?.aborted) return;

      setDataVersion((v) => v + 1);

      if (!alive(viewerRef.current) || !layersRef.current) return;

      countriesRef.current = geo;
      setFocusGeometry(geo);

      await layersRef.current.setCountries(geo);
      if (signal?.aborted) return;

      if (nexusFile) {
        loadNexusFile(nexusFile);
        const { stateNexus, countryIndex } = useNexusStore.getState();
        layersRef.current?.setNexusData(stateNexus, countryIndex);
      }

      if (!alive(viewerRef.current)) return;

      enableAutoRotate(viewerRef.current);
      setGlobeReady(true);

      if (nexusFile) {
        const { countryIndex } = useNexusStore.getState();
        const ids = Object.keys(countryIndex);
        const PREFETCH_CONCURRENCY = 3;
        const PREFETCH_DELAY_MS = 200;
        let i = 0;
        const prefetchNext = () => {
          const batch: Promise<unknown>[] = [];
          while (i < ids.length && batch.length < PREFETCH_CONCURRENCY) {
            const entry = getRegionEntry(ids[i++]!);
            if (entry?.childDatasetPath) {
              batch.push(prefetchDataset(entry.childDatasetPath));
            }
          }
          if (batch.length > 0) {
            Promise.all(batch).then(() => {
              if (i < ids.length) setTimeout(prefetchNext, PREFETCH_DELAY_MS);
            });
          }
        };
        setTimeout(prefetchNext, 1000);
      }
    } catch (err) {
      console.error("[boot] Boot failed:", err);
      const raw = err instanceof Error ? err.message : "Failed to load.";
      const isConnectionFailed =
        /connection\s*failed|failed\s*to\s*fetch|load\s*failed|networkerror|network\s*request\s*failed|refused|net::err|unable\s*to\s*connect/i.test(raw);

      setError(
        isConnectionFailed
          ? "Can't reach the data files. Check your network connection or try refreshing."
          : "Failed to load. Check the browser console for details.",
      );
      setGlobeReady(true);
    }
  }, [ensureViewer, viewerRef, layersRef, countriesRef, loadNexusFile]);

  useEffect(() => {
    const ac = new AbortController();
    boot(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { dataVersion, setDataVersion, globeReady, error, boot, bootStatus };
}
