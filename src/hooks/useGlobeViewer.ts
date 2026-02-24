/**
 * ── useGlobeViewer ──────────────────────────────────────────────────────
 *
 * Manages the Cesium Viewer and LayerManager lifecycle.
 * Creates them once on mount, destroys on unmount.
 */

import { useRef, useEffect } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { createViewer, LayerManager, disableAutoRotate } from "../globe";
import type { RegionFeatureCollection } from "../types";

function viewerOk(v: CesiumViewer | null): v is CesiumViewer {
  return !!v && !v.isDestroyed();
}

export function useGlobeViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const layersRef = useRef<LayerManager | null>(null);
  const countriesRef = useRef<RegionFeatureCollection | null>(null);

  useEffect(() => {
    return () => {
      disableAutoRotate();
      layersRef.current?.destroy();
      layersRef.current = null;
      if (viewerOk(viewerRef.current)) viewerRef.current.destroy();
      viewerRef.current = null;
    };
  }, []);

  const ensureViewer = () => {
    if (!viewerOk(viewerRef.current) && mountRef.current) {
      viewerRef.current = createViewer(mountRef.current);
      layersRef.current = new LayerManager(viewerRef.current);
    }
  };

  return { mountRef, viewerRef, layersRef, countriesRef, viewerOk, ensureViewer };
}
