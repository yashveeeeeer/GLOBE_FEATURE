/**
 * ── Filter Panel ────────────────────────────────────────────────────────
 *
 * Minimal inline text toggles for Physical / Economic nexus filters.
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
      <span className="filter-panel__label">FILTER</span>
      <button
        type="button"
        className={`filter-panel__toggle${physical ? " filter-panel__toggle--active" : ""}`}
        onClick={togglePhysical}
        style={physical ? { color: NEXUS_PHYSICAL_FILL } : undefined}
        aria-pressed={physical}
      >
        Physical
      </button>
      <button
        type="button"
        className={`filter-panel__toggle${economic ? " filter-panel__toggle--active" : ""}`}
        onClick={toggleEconomic}
        style={economic ? { color: NEXUS_ECONOMIC_FILL } : undefined}
        aria-pressed={economic}
      >
        Economic
      </button>
    </div>
  );
});
