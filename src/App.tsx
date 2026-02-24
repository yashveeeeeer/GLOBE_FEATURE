/**
 * ── App root ───────────────────────────────────────────────────────────
 *
 * Two-pane layout: Globe (left 65%) + Sidebar (right 35%).
 *
 * Boot:
 *   1. Create Cesium viewer + LayerManager.
 *   2. Load region index → table renders.
 *   3. Load countries TopoJSON → render outlines.
 *   4. Enable auto-rotation.
 *
 * Selection → camera flight + highlight + lazy subregion load.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { useSelectionStore } from "./state/selectionStore";
import { loadRegionIndex, getRegionEntry } from "./data/regionIndex";
import { loadDataset } from "./data/loader";
import {
  createViewer,
  LayerManager,
  focusToRegion,
  focusToWorld,
  setFocusGeometry,
  enableAutoRotate,
  disableAutoRotate,
} from "./globe";
import { Breadcrumb } from "./ui/Breadcrumb";
import { RegionTable } from "./ui/RegionTable";
import { ErrorBanner } from "./ui/ErrorBanner";
import { ThemeToggle } from "./ui/ThemeToggle";
import { NexusLegend } from "./ui/NexusLegend";
import type { RegionFeatureCollection } from "./types";

import "./App.css";

/* ── Helpers ─────────────────────────────────────────────────────────── */

function viewerOk(v: CesiumViewer | null): v is CesiumViewer {
  return !!v && !v.isDestroyed();
}

export default function App() {
  /* ── Refs ─────────────────────────────────────────────────────────── */

  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const layersRef = useRef<LayerManager | null>(null);
  const countriesRef = useRef<RegionFeatureCollection | null>(null);

  /* ── State ────────────────────────────────────────────────────────── */

  const [dataVersion, setDataVersion] = useState(0);
  const [globeReady, setGlobeReady] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Zustand ─────────────────────────────────────────────────────── */

  const selectionLevel = useSelectionStore((s) => s.selectionLevel);
  const selectedCountryId = useSelectionStore((s) => s.selectedCountryId);
  const selectedSubregionId = useSelectionStore((s) => s.selectedSubregionId);

  /* ── Boot ─────────────────────────────────────────────────────────── */

  const boot = useCallback(async () => {
    try {
      setError(null);
      setGlobeReady(false);

      // 1) Create viewer + layer manager
      if (!viewerOk(viewerRef.current) && mountRef.current) {
        viewerRef.current = createViewer(mountRef.current);
        layersRef.current = new LayerManager(viewerRef.current);
      }

      // 2) Load region index → table
      await loadRegionIndex();
      setDataVersion((v) => v + 1);

      if (!viewerOk(viewerRef.current)) return;

      // 3) Load countries (TopoJSON if available, fallback to GeoJSON)
      const base = import.meta.env.BASE_URL;
      let geo: RegionFeatureCollection;
      try {
        geo = await loadDataset(`${base}data/countries.topo.json`);
      } catch {
        geo = await loadDataset(`${base}data/countries.geo.json`);
      }
      countriesRef.current = geo;
      setFocusGeometry(geo);

      if (!viewerOk(viewerRef.current) || !layersRef.current) return;
      await layersRef.current.setCountries(geo);

      // 4) Load nexus exposure data and apply colors
      try {
        const nexusRes = await fetch(`${base}data/nexus_exposure.json`);
        if (nexusRes.ok) {
          const nexusData = await nexusRes.json();
          layersRef.current?.applyNexusColors(nexusData);
        }
      } catch {
        console.warn("[App] Nexus data not available, skipping color overlay");
      }

      if (!viewerOk(viewerRef.current)) return;

      // 5) Auto-rotation
      enableAutoRotate(viewerRef.current);
      setGlobeReady(true);
    } catch (err) {
      console.error("[App] Boot failed:", err);
      const raw = err instanceof Error ? err.message : "Failed to load.";
      const rawLower = raw.toLowerCase();
      const isConnectionFailed =
        /connection\s*failed|failed\s*to\s*fetch|load\s*failed|networkerror|network\s*request\s*failed|refused|net::err|unable\s*to\s*connect/i.test(raw) ||
        (rawLower.includes("connection") && rawLower.includes("fail")) ||
        rawLower.includes("err_connection");
      // Always show friendly message for boot failures so the UI never shows raw
      // "connection failed" or other browser messages. Connection-type errors get
      // dev-server instructions; others get a generic message (details stay in console).
      const finalMessage =
        isConnectionFailed
          ? "Can't reach the data files. Check your network connection or try refreshing."
          : "Failed to load. Check the browser console for details.";
      setError(finalMessage);
      setGlobeReady(true);
    }
  }, []);

  useEffect(() => {
    boot();
    return () => {
      disableAutoRotate();
      layersRef.current?.destroy();
      layersRef.current = null;
      if (viewerOk(viewerRef.current)) viewerRef.current.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Selection changes ───────────────────────────────────────────── */

  useEffect(() => {
    if (dataVersion === 0) return;
    if (!viewerOk(viewerRef.current) || !layersRef.current) return;

    const lm = layersRef.current;
    let cancelled = false;

    (async () => {
      try {
        /* ── World ──────────────────────────────────────────────── */
        if (selectionLevel === "world") {
          disableAutoRotate();
          lm.clearHighlight();
          lm.clearSubregions();
          lm.showCountries(); // restore adm0 outlines
          setFocusGeometry(countriesRef.current);

          if (!cancelled && viewerOk(viewerRef.current)) {
            focusToWorld(viewerRef.current);
            enableAutoRotate(viewerRef.current);
          }
          return;
        }

        /* ── Country ────────────────────────────────────────────── */
        if (selectionLevel === "country" && selectedCountryId) {
          disableAutoRotate();
          lm.hideCountries(); // hide adm0 outlines for clean transition
          lm.showSubregions(); // restore subregion outlines if coming back from subregion drill
          lm.clearHighlight(); // clear subregion highlight

          // 1) Start camera flight immediately — bbox mode is instant
          if (!cancelled && viewerOk(viewerRef.current)) {
            focusToRegion(viewerRef.current, selectedCountryId, { mode: "bbox" });
          }

          // 3) Defer heavy subregion loading so the camera flight can
          //    render visible motion before the main thread blocks
          const entry = getRegionEntry(selectedCountryId);
          if (entry?.childDatasetPath) {
            setSubLoading(true);
            try {
              // Give the camera flight a 300ms head start so the user
              // sees motion before JSON.parse + entity creation blocks
              await new Promise((r) => setTimeout(r, 300));
              if (cancelled) return;

              const sub = await loadDataset(entry.childDatasetPath);
              if (!cancelled && viewerOk(viewerRef.current)) {
                lm.clearHighlight();
                await lm.setSubregions(sub);
                setFocusGeometry(sub);
                // No country highlight here — the subregion outlines
                // ARE the visual feedback. A country-level fill would
                // cover and hide the state boundaries.
              }
            } finally {
              setSubLoading(false);
            }
          }
          return;
        }

        /* ── Subregion ──────────────────────────────────────────── */
        if (selectionLevel === "subregion" && selectedSubregionId && selectedCountryId) {
          lm.hideSubregions(); // hide other subregion outlines for clean view

          const entry = getRegionEntry(selectedCountryId);
          if (entry?.childDatasetPath) {
            const sub = await loadDataset(entry.childDatasetPath);
            if (!cancelled && viewerOk(viewerRef.current)) {
              await lm.highlight(selectedSubregionId, sub);
              focusToRegion(viewerRef.current, selectedSubregionId, { mode: "auto" });
            }
          }
        }
      } catch (err) {
        console.error("[App] Selection error:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [selectionLevel, selectedCountryId, selectedSubregionId, dataVersion]);

  /* ── Spacebar on globe → reset to world + auto-rotate ────────────── */

  const resetToWorld = useSelectionStore((s) => s.resetToWorld);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      resetToWorld();
    };

    // Make globe focusable so it receives key events
    el.setAttribute("tabindex", "0");
    el.style.outline = "none"; // no focus ring
    el.addEventListener("keydown", onKeyDown);

    // Auto-focus globe when user clicks on it
    const onClick = () => el.focus();
    el.addEventListener("click", onClick);

    return () => {
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("click", onClick);
    };
  }, [resetToWorld]);

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div className="app">
      <div className="app__globe">
        <div className="app__globe-mount" ref={mountRef} />
        {globeReady && <NexusLegend />}
        {!globeReady && (
          <div className="app__loading"><p>Loading globe…</p></div>
        )}
      </div>

      <aside className="app__sidebar">
        <header className="app__sidebar-header">
          <div className="app__sidebar-header-row">
            <h1 className="app__title">Globe Drilldown</h1>
            <ThemeToggle />
          </div>
          <Breadcrumb />
        </header>

        {error ? (
          <ErrorBanner message={error} onRetry={boot} />
        ) : (
          <RegionTable dataVersion={dataVersion} loading={subLoading} />
        )}
      </aside>
    </div>
  );
}
