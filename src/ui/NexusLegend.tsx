/**
 * ── Nexus Legend ─────────────────────────────────────────────────────────
 *
 * Flat text overlay on the globe. No card, no blur -- just colored
 * squares and uppercase labels with a text shadow for readability.
 */

import { memo } from "react";
import { useNexusStore } from "../state/nexusStore";
import {
  NEXUS_PHYSICAL_FILL,
  NEXUS_ECONOMIC_FILL,
  NEXUS_BOTH_FILL,
  NEXUS_CLEAR_FILL,
} from "../globe/styles";

interface LegendItem {
  color: string;
  label: string;
}

export const NexusLegend = memo(function NexusLegend() {
  const physical = useNexusStore((s) => s.filters.physical);
  const economic = useNexusStore((s) => s.filters.economic);

  const items: LegendItem[] = [];

  if (physical && economic) {
    items.push({ color: NEXUS_BOTH_FILL, label: "BOTH" });
    items.push({ color: NEXUS_PHYSICAL_FILL, label: "PHYSICAL" });
    items.push({ color: NEXUS_ECONOMIC_FILL, label: "ECONOMIC" });
  } else if (physical) {
    items.push({ color: NEXUS_PHYSICAL_FILL, label: "PHYSICAL" });
  } else if (economic) {
    items.push({ color: NEXUS_ECONOMIC_FILL, label: "ECONOMIC" });
  }

  items.push({ color: NEXUS_CLEAR_FILL, label: "CLEAR" });

  return (
    <div className="nexus-legend">
      {items.map((item) => (
        <div key={item.label} className="nexus-legend__item">
          <span className="nexus-legend__swatch" style={{ background: item.color }} />
          <span className="nexus-legend__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
});
