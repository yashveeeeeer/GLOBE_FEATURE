/**
 * ── App root ───────────────────────────────────────────────────────────
 *
 * Two-pane layout: Globe (left 65%) + Sidebar (right 35%).
 * NASA technical-publication aesthetic: sharp, functional, monospaced
 * readouts. Breadcrumb sits at the bottom as a status bar.
 */

import { useEffect } from "react";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { useGlobeViewer } from "./hooks/useGlobeViewer";
import { useGlobeBoot } from "./hooks/useGlobeBoot";
import { useSelectionEffect } from "./hooks/useSelectionEffect";
import { useKeyboardReset } from "./hooks/useKeyboardReset";
import { useRenderHealth } from "./hooks/useRenderHealth";

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

  const { dataVersion, setDataVersion, globeReady, error, boot } =
    useGlobeBoot({
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

  const { stalled, recover } = useRenderHealth(viewerRef, globeReady);

  const filters = useNexusStore((s) => s.filters);

  useEffect(() => {
    layersRef.current?.recolorForFilters(filters);
  }, [filters, layersRef]);

  useEffect(() => {
    let rafId = 0;
    const onThemeChange = (e: Event) => {
      const isLight = (e as CustomEvent<{ isLight: boolean }>).detail.isLight;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        layersRef.current?.recolorOutlines(isLight);
      });
    };
    document.addEventListener("theme-change", onThemeChange);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("theme-change", onThemeChange);
    };
  }, [layersRef]);

  return (
    <>
      <LoadingScreen ready={globeReady} />

      <div className="app">
        <GlobeErrorBoundary>
          <div className="app__globe">
            <div className="app__globe-mount" ref={mountRef} />
            {globeReady && <NexusLegend />}
            {globeReady && <NexusTooltip viewerRef={viewerRef} />}
            {stalled && (
              <div className="globe-stalled">
                <span className="globe-stalled__text">
                  GLOBE RENDER STALLED
                </span>
                <button
                  type="button"
                  className="globe-stalled__btn"
                  onClick={recover}
                >
                  RELOAD
                </button>
              </div>
            )}
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
                    width={24}
                    height={24}
                  />
                  <img
                    className="app__logo-img app__logo-img--light"
                    src={`${import.meta.env.BASE_URL}assets/logo-dark.png`}
                    alt="Commenda"
                    width={24}
                    height={24}
                  />
                </div>
                <div className="app__brand-text">
                  <h1 className="app__title">COMMENDA</h1>
                  <span className="app__subtitle">NEXUS EXPOSURE</span>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </header>

          <StatsBar dataVersion={dataVersion} />
          <FilterPanel />

          {error ? (
            <ErrorBanner message={error} onRetry={() => boot()} />
          ) : (
            <RegionTable dataVersion={dataVersion} loading={subLoading} />
          )}

          <footer className="app__status-bar">
            <Breadcrumb />
          </footer>
        </aside>
      </div>
    </>
  );
}
