/**
 * ── Nexus Tooltip ───────────────────────────────────────────────────────
 *
 * Minimal solid tooltip on globe hover. No blur, no glass-morphism.
 * Monospaced YES/NO status values.
 */

import { memo, type RefObject } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { useGlobeHover } from "../hooks/useGlobeHover";
import { useNexusStore } from "../state/nexusStore";
import { getRegionEntry } from "../data/regionIndex";

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

  const tooltipW = 180;
  const tooltipH = 80;
  const pad = 16;
  const rawX = hover.screenX + pad;
  const rawY = hover.screenY - 10;

  const globeEl = document.querySelector(".app__globe");
  const bounds = globeEl?.getBoundingClientRect();
  const maxX = bounds ? bounds.width - tooltipW - 8 : window.innerWidth - tooltipW - 8;
  const maxY = bounds ? bounds.height - tooltipH - 8 : window.innerHeight - tooltipH - 8;

  const clampedX = rawX > maxX ? hover.screenX - tooltipW - pad : rawX;
  const clampedY = Math.max(8, Math.min(rawY, maxY));

  return (
    <div className="nexus-tooltip" style={{ left: clampedX, top: clampedY }}>
      <div className="nexus-tooltip__name">{name}</div>
      {entry ? (
        <div className="nexus-tooltip__rows">
          <div className="nexus-tooltip__row">
            <span className="nexus-tooltip__row-label">Physical</span>
            <span className={`nexus-tooltip__row-val${entry.physical ? " nexus-tooltip__row-val--yes" : ""}`}>
              {entry.physical ? "YES" : "NO"}
            </span>
          </div>
          <div className="nexus-tooltip__row">
            <span className="nexus-tooltip__row-label">Economic</span>
            <span className={`nexus-tooltip__row-val${entry.economic ? " nexus-tooltip__row-val--yes" : ""}`}>
              {entry.economic ? "YES" : "NO"}
            </span>
          </div>
        </div>
      ) : (
        <div className="nexus-tooltip__rows">
          <span className="nexus-tooltip__no-data">No exposure data</span>
        </div>
      )}
    </div>
  );
});
