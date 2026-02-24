/**
 * ── Filter Panel ────────────────────────────────────────────────────────
 *
 * Toggle buttons for Physical / Economic nexus filters.
 * Toggling re-colors the globe via the Zustand nexus store.
 */

import { memo } from "react";
import { useNexusStore } from "../state/nexusStore";
import {
  NEXUS_PHYSICAL_FILL,
  NEXUS_ECONOMIC_FILL,
} from "../globe/styles";

export const FilterPanel = memo(function FilterPanel() {
  const physical = useNexusStore((s) => s.filters.physical);
  const economic = useNexusStore((s) => s.filters.economic);
  const togglePhysical = useNexusStore((s) => s.togglePhysical);
  const toggleEconomic = useNexusStore((s) => s.toggleEconomic);

  return (
    <div className="filter-panel">
      <span className="filter-panel__label">Filters</span>
      <div className="filter-panel__toggles">
        <button
          type="button"
          className={`filter-panel__btn ${physical ? "filter-panel__btn--active" : ""}`}
          onClick={togglePhysical}
          style={{ "--filter-color": NEXUS_PHYSICAL_FILL } as React.CSSProperties}
          aria-pressed={physical}
        >
          <span className="filter-panel__indicator" />
          Physical Nexus
        </button>
        <button
          type="button"
          className={`filter-panel__btn ${economic ? "filter-panel__btn--active" : ""}`}
          onClick={toggleEconomic}
          style={{ "--filter-color": NEXUS_ECONOMIC_FILL } as React.CSSProperties}
          aria-pressed={economic}
        >
          <span className="filter-panel__indicator" />
          Economic Nexus
        </button>
      </div>
    </div>
  );
});
