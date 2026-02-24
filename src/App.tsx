/**
 * ── App root ───────────────────────────────────────────────────────────
 *
 * Two-pane layout: Globe (left 65%) + Sidebar (right 35%).
 * Composes custom hooks for viewer lifecycle, boot, selection, and input.
 */

import { useEffect } from "react";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { useGlobeViewer } from "./hooks/useGlobeViewer";
import { useGlobeBoot } from "./hooks/useGlobeBoot";
import { useSelectionEffect } from "./hooks/useSelectionEffect";
import { useKeyboardReset } from "./hooks/useKeyboardReset";

import { useNexusStore } from "./state/nexusStore";

import { Breadcrumb } from "./ui/Breadcrumb";
import { RegionTable } from "./ui/RegionTable";
import { ErrorBanner } from "./ui/ErrorBanner";
import { ThemeToggle } from "./ui/ThemeToggle";
import { NexusLegend } from "./ui/NexusLegend";
import { FilterPanel } from "./ui/FilterPanel";
import { NexusTooltip } from "./ui/NexusTooltip";

import "./App.css";

export default function App() {
  const { mountRef, viewerRef, layersRef, countriesRef, ensureViewer } =
    useGlobeViewer();

  const { dataVersion, globeReady, error, boot } = useGlobeBoot({
    viewerRef,
    layersRef,
    countriesRef,
    ensureViewer,
  });

  const { subLoading } = useSelectionEffect({
    viewerRef,
    layersRef,
    countriesRef,
    dataVersion,
  });

  useKeyboardReset(mountRef);

  /* ── Re-color globe when filters change ────────────────────────────── */

  const filters = useNexusStore((s) => s.filters);

  useEffect(() => {
    layersRef.current?.recolorForFilters(filters);
  }, [filters, layersRef]);

  /* ── Render ────────────────────────────────────────────────────────── */

  return (
    <div className="app">
      <div className="app__globe">
        <div className="app__globe-mount" ref={mountRef} />
        {globeReady && <NexusLegend />}
        {globeReady && <NexusTooltip viewerRef={viewerRef} />}
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

        <FilterPanel />

        {error ? (
          <ErrorBanner message={error} onRetry={() => boot()} />
        ) : (
          <RegionTable dataVersion={dataVersion} loading={subLoading} />
        )}
      </aside>
    </div>
  );
}
