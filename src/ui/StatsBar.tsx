/**
 * ── Readout Bar ──────────────────────────────────────────────────────
 *
 * Three monospaced numerical readouts: total jurisdictions, physical
 * nexus count, economic nexus count. Numbers animate on value change.
 */

import { memo, useEffect, useRef, useState } from "react";
import { useNexusStore } from "../state/nexusStore";
import { useSelectionStore } from "../state/selectionStore";
import { getRegionsByLevel } from "../data/regionIndex";
import {
  NEXUS_PHYSICAL_FILL,
  NEXUS_ECONOMIC_FILL,
} from "../globe/styles";

function useAnimatedCount(target: number, duration = 400): number {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const start = display;
    const diff = target - start;
    if (diff === 0) return;
    const t0 = performance.now();

    const tick = (now: number) => {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}

interface ReadoutProps {
  label: string;
  value: number;
  color?: string;
}

function Readout({ label, value, color }: ReadoutProps) {
  const animated = useAnimatedCount(value);

  return (
    <div className="readout">
      <span className="readout__label">{label}</span>
      <span className="readout__value" style={color ? { color } : undefined}>
        {animated}
      </span>
    </div>
  );
}

interface StatsBarProps {
  dataVersion: number;
}

export const StatsBar = memo(function StatsBar({ dataVersion }: StatsBarProps) {
  const selectionLevel = useSelectionStore((s) => s.selectionLevel);
  const selectedCountryId = useSelectionStore((s) => s.selectedCountryId);
  const stateNexus = useNexusStore((s) => s.stateNexus);
  const countryIndex = useNexusStore((s) => s.countryIndex);
  const filters = useNexusStore((s) => s.filters);

  void dataVersion;

  let total = 0;
  let physicalCount = 0;
  let economicCount = 0;

  if (selectionLevel === "world") {
    const countries = getRegionsByLevel("country");
    total = countries.length;
    for (const [cid] of countries) {
      const stateIds = countryIndex[cid];
      if (!stateIds) continue;
      let hasPhy = false;
      let hasEco = false;
      for (const sid of stateIds) {
        const entry = stateNexus[sid];
        if (!entry) continue;
        if (entry.physical) hasPhy = true;
        if (entry.economic) hasEco = true;
      }
      if (hasPhy) physicalCount++;
      if (hasEco) economicCount++;
    }
  } else if (selectionLevel === "country" && selectedCountryId) {
    const subs = getRegionsByLevel("subregion", selectedCountryId);
    total = subs.length;
    for (const [sid] of subs) {
      const entry = stateNexus[sid];
      if (!entry) continue;
      if (filters.physical && entry.physical) physicalCount++;
      if (filters.economic && entry.economic) economicCount++;
    }
  }

  return (
    <div className="readout-bar">
      <Readout
        label={selectionLevel === "world" ? "JURISDICTIONS" : "SUBREGIONS"}
        value={total}
      />
      <div className="readout-bar__sep" />
      <Readout label="PHYSICAL" value={physicalCount} color={NEXUS_PHYSICAL_FILL} />
      <div className="readout-bar__sep" />
      <Readout label="ECONOMIC" value={economicCount} color={NEXUS_ECONOMIC_FILL} />
    </div>
  );
});
