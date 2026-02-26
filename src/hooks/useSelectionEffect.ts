/**
 * ── useSelectionEffect ──────────────────────────────────────────────────
 *
 * Reacts to drill-down selection changes:
 *  - World → reset camera + auto-rotate
 *  - Country → fly to country, load subregions
 *  - Subregion → highlight + zoom
 *
 * Uses AbortController for clean cancellation of async work.
 */

import { useEffect, useState, type RefObject } from "react";
import type { Viewer as CesiumViewer } from "cesium";

import { useSelectionStore } from "../state/selectionStore";
import { getRegionEntry, ensureFullIndex } from "../data/regionIndex";
import { loadDataset } from "../data/loader";
import {
  alive,
  LayerManager,
  focusToRegion,
  focusToWorld,
  setFocusGeometry,
  enableAutoRotate,
  disableAutoRotate,
} from "../globe";
import type { RegionFeatureCollection } from "../types";

interface UseSelectionEffectArgs {
  viewerRef: RefObject<CesiumViewer | null>;
  layersRef: RefObject<LayerManager | null>;
  countriesRef: RefObject<RegionFeatureCollection | null>;
  dataVersion: number;
  setDataVersion: React.Dispatch<React.SetStateAction<number>>;
}

export function useSelectionEffect({
  viewerRef,
  layersRef,
  countriesRef,
  dataVersion,
  setDataVersion,
}: UseSelectionEffectArgs) {
  const [subLoading, setSubLoading] = useState(false);

  const selectionLevel = useSelectionStore((s) => s.selectionLevel);
  const selectedCountryId = useSelectionStore((s) => s.selectedCountryId);
  const selectedSubregionId = useSelectionStore((s) => s.selectedSubregionId);

  useEffect(() => {
    if (dataVersion === 0) return;
    if (!alive(viewerRef.current) || !layersRef.current) return;

    const ac = new AbortController();
    const lm = layersRef.current;

    (async () => {
      try {
        if (selectionLevel === "world") {
          disableAutoRotate();
          lm.clearHighlight();
          lm.clearSubregions();
          lm.showCountries();
          setFocusGeometry(countriesRef.current);

          if (!ac.signal.aborted && alive(viewerRef.current)) {
            focusToWorld(viewerRef.current);
            enableAutoRotate(viewerRef.current);
          }
          return;
        }

        if (selectionLevel === "country" && selectedCountryId) {
          disableAutoRotate();
          lm.hideCountries();
          lm.showSubregions();
          lm.clearHighlight();

          if (!ac.signal.aborted && alive(viewerRef.current)) {
            focusToRegion(viewerRef.current, selectedCountryId, { mode: "bbox" });
          }

          await ensureFullIndex();
          if (ac.signal.aborted) return;
          setDataVersion((v) => v + 1);

          const entry = getRegionEntry(selectedCountryId);
          if (entry?.childDatasetPath) {
            setSubLoading(true);
            try {
              const sub = await loadDataset(entry.childDatasetPath);
              if (!ac.signal.aborted && alive(viewerRef.current)) {
                lm.clearHighlight();
                await lm.setSubregions(sub);
                setFocusGeometry(sub);
              }
            } finally {
              setSubLoading(false);
            }
          }
          return;
        }

        if (selectionLevel === "subregion" && selectedSubregionId && selectedCountryId) {
          lm.hideSubregions();

          await ensureFullIndex();
          if (ac.signal.aborted) return;

          const entry = getRegionEntry(selectedCountryId);
          if (entry?.childDatasetPath) {
            const sub = await loadDataset(entry.childDatasetPath);
            if (!ac.signal.aborted && alive(viewerRef.current)) {
              await lm.highlight(selectedSubregionId, sub);
              focusToRegion(viewerRef.current, selectedSubregionId, { mode: "auto" });
            }
          }
        }
      } catch (err) {
        console.error("[selection] Selection error:", err);
      }
    })();

    return () => ac.abort();
  }, [selectionLevel, selectedCountryId, selectedSubregionId, dataVersion, viewerRef, layersRef, countriesRef]);

  return { subLoading };
}
