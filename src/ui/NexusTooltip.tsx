/**
 * ── Nexus Tooltip ───────────────────────────────────────────────────────
 *
 * Shows a positioned tooltip when hovering a state/subregion on the globe.
 * Displays the state name and Physical/Economic nexus breakdown.
 */

import { memo, type RefObject } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { useGlobeHover } from "../hooks/useGlobeHover";
import { useNexusStore } from "../state/nexusStore";
import { getRegionEntry } from "../data/regionIndex";
import {
  NEXUS_PHYSICAL_FILL,
  NEXUS_ECONOMIC_FILL,
} from "../globe/styles";

interface NexusTooltipProps {
  viewerRef: RefObject<CesiumViewer | null>;
}

export const NexusTooltip = memo(function NexusTooltip({ viewerRef }: NexusTooltipProps) {
  const hover = useGlobeHover(viewerRef);
  const stateNexus = useNexusStore((s) => s.stateNexus);

  if (!hover) return null;

  const entry = stateNexus[hover.entityId];
  const regionEntry = getRegionEntry(hover.entityId);
  const name = regionEntry?.name ?? hover.entityId;

  if (!entry && !regionEntry) return null;

  return (
    <div
      className="nexus-tooltip"
      style={{
        left: hover.screenX + 14,
        top: hover.screenY - 10,
      }}
    >
      <div className="nexus-tooltip__name">{name}</div>
      {entry ? (
        <div className="nexus-tooltip__rows">
          <div className="nexus-tooltip__row">
            <span
              className="nexus-tooltip__dot"
              style={{ background: NEXUS_PHYSICAL_FILL }}
            />
            <span>Physical</span>
            <span className={`nexus-tooltip__val ${entry.physical ? "nexus-tooltip__val--yes" : ""}`}>
              {entry.physical ? "Yes" : "No"}
            </span>
          </div>
          <div className="nexus-tooltip__row">
            <span
              className="nexus-tooltip__dot"
              style={{ background: NEXUS_ECONOMIC_FILL }}
            />
            <span>Economic</span>
            <span className={`nexus-tooltip__val ${entry.economic ? "nexus-tooltip__val--yes" : ""}`}>
              {entry.economic ? "Yes" : "No"}
            </span>
          </div>
        </div>
      ) : (
        <div className="nexus-tooltip__rows">
          <span className="nexus-tooltip__no-data">No nexus data</span>
        </div>
      )}
    </div>
  );
});
