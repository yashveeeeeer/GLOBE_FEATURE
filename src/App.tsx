/**
 * ── App root ───────────────────────────────────────────────────────────
 *
 * Two-pane layout: Globe (left 65%) + Sidebar (right 35%).
 * Composes custom hooks for viewer lifecycle, boot, selection, and input.
 *
 * A full-screen video loading screen covers everything until all data
 * is fetched and the globe is interactive — zero visible lag.
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
import { StatsBar } from "./ui/StatsBar";
import { ErrorBanner } from "./ui/ErrorBanner";
import { ThemeToggle } from "./ui/ThemeToggle";
import { NexusLegend } from "./ui/NexusLegend";
import { FilterPanel } from "./ui/FilterPanel";
import { NexusTooltip } from "./ui/NexusTooltip";
import { GlobeErrorBoundary } from "./ui/GlobeErrorBoundary";
import { LoadingScreen } from "./ui/LoadingScreen";

import "./App.css";

export default function App() {
  const { mountRef, viewerRef, layersRef, countriesRef, ensureViewer } =
    useGlobeViewer();

  const { dataVersion, setDataVersion, globeReady, error, boot } = useGlobeBoot({
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
    setDataVersion,
  });

  useKeyboardReset(mountRef);

  /* ── Re-color globe when filters change ────────────────────────────── */

  const filters = useNexusStore((s) => s.filters);

  useEffect(() => {
    layersRef.current?.recolorForFilters(filters);
  }, [filters, layersRef]);

  /* ── Render ────────────────────────────────────────────────────────── */

  return (
    <>
      <LoadingScreen ready={globeReady} />

      <div className="app">
        <GlobeErrorBoundary>
          <div className="app__globe">
            <div className="app__globe-mount" ref={mountRef} />
            {globeReady && <NexusLegend />}
            {globeReady && <NexusTooltip viewerRef={viewerRef} />}
          </div>
        </GlobeErrorBoundary>

        <aside className="app__sidebar">
          <header className="app__sidebar-header">
            <div className="app__sidebar-header-row">
              <div className="app__brand">
                <div className="app__logo">
                  <img
                    className="app__logo-img app__logo-img--dark"
                    src={`${import.meta.env.BASE_URL}assets/logo-light.png`}
                    alt="Commenda"
                    width={28}
                    height={28}
                  />
                  <img
                    className="app__logo-img app__logo-img--light"
                    src={`${import.meta.env.BASE_URL}assets/logo-dark.png`}
                    alt="Commenda"
                    width={28}
                    height={28}
                  />
                </div>
                <div className="app__brand-text">
                  <h1 className="app__title">Commenda</h1>
                  <span className="app__subtitle">Nexus Exposure Map</span>
                </div>
              </div>
              <ThemeToggle />
            </div>
            <Breadcrumb />
          </header>

          <FilterPanel />
          <StatsBar dataVersion={dataVersion} />

          {error ? (
            <ErrorBanner message={error} onRetry={() => boot()} />
          ) : (
            <RegionTable dataVersion={dataVersion} loading={subLoading} />
          )}
        </aside>
      </div>
    </>
  );
}
