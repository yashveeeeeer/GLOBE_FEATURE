/**
 * ── Nexus Legend ─────────────────────────────────────────────────────────
 *
 * Dynamic legend that reflects the active nexus filters.
 * Shows only the relevant color categories.
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
    items.push({ color: NEXUS_BOTH_FILL, label: "Both Nexus" });
    items.push({ color: NEXUS_PHYSICAL_FILL, label: "Physical Only" });
    items.push({ color: NEXUS_ECONOMIC_FILL, label: "Economic Only" });
  } else if (physical) {
    items.push({ color: NEXUS_PHYSICAL_FILL, label: "Physical Nexus" });
  } else if (economic) {
    items.push({ color: NEXUS_ECONOMIC_FILL, label: "Economic Nexus" });
  }

  items.push({ color: NEXUS_CLEAR_FILL, label: "No Nexus" });

  return (
    <div className="nexus-legend">
      <span className="nexus-legend__title">Exposure</span>
      {items.map((item) => (
        <div key={item.label} className="nexus-legend__item">
          <span
            className="nexus-legend__swatch"
            style={{ background: item.color, "--swatch-color": item.color } as React.CSSProperties}
          />
          <span className="nexus-legend__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
});
