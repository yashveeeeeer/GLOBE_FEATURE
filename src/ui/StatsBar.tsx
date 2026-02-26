/**
 * ── Stats Bar ─────────────────────────────────────────────────────────
 *
 * Compact summary metrics: total regions, physical/economic nexus counts.
 * Numbers animate in on first render and on drill-level changes.
 */

import { memo, useEffect, useRef, useState } from "react";
import { useNexusStore } from "../state/nexusStore";
import { useSelectionStore } from "../state/selectionStore";
import { getRegionsByLevel } from "../data/regionIndex";
import {
  NEXUS_PHYSICAL_FILL,
  NEXUS_ECONOMIC_FILL,
  NEXUS_BOTH_FILL,
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

interface StatCardProps {
  label: string;
  value: number;
  color?: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, color, icon }: StatCardProps) {
  const animated = useAnimatedCount(value);

  return (
    <div className="stats-bar__card" style={color ? { "--stat-accent": color } as React.CSSProperties : undefined}>
      <div className="stats-bar__icon">{icon}</div>
      <div className="stats-bar__info">
        <span className="stats-bar__value">{animated}</span>
        <span className="stats-bar__label">{label}</span>
      </div>
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
  let bothCount = 0;

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
      if (hasPhy && hasEco) bothCount++;
      else if (hasPhy) physicalCount++;
      else if (hasEco) economicCount++;
    }
  } else if (selectionLevel === "country" && selectedCountryId) {
    const subs = getRegionsByLevel("subregion", selectedCountryId);
    total = subs.length;
    for (const [sid] of subs) {
      const entry = stateNexus[sid];
      if (!entry) continue;
      const showPhy = filters.physical && entry.physical;
      const showEco = filters.economic && entry.economic;
      if (showPhy && showEco) bothCount++;
      else if (showPhy) physicalCount++;
      else if (showEco) economicCount++;
    }
  }

  const globeIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );

  const shieldIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );

  const dollarIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );

  const alertIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );

  return (
    <div className="stats-bar">
      <StatCard
        label={selectionLevel === "world" ? "Countries" : "Subregions"}
        value={total}
        icon={globeIcon}
      />
      <StatCard label="Physical" value={physicalCount} color={NEXUS_PHYSICAL_FILL} icon={shieldIcon} />
      <StatCard label="Economic" value={economicCount} color={NEXUS_ECONOMIC_FILL} icon={dollarIcon} />
      <StatCard label="Both" value={bothCount} color={NEXUS_BOTH_FILL} icon={alertIcon} />
    </div>
  );
});
