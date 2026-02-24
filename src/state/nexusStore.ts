/**
 * ── Nexus Store (Zustand) ─────────────────────────────────────────────
 *
 * Manages nexus exposure data (per-state physical/economic flags),
 * the active filter toggles, and a country→states index for rollup.
 */

import { create } from "zustand";
import type {
  NexusEntry,
  NexusStateData,
  NexusDataFile,
  NexusFilters,
} from "../types";

/* ── State shape ─────────────────────────────────────────────────────── */

interface NexusState {
  stateNexus: NexusStateData;
  countryIndex: Record<string, string[]>;
  filters: NexusFilters;
}

interface NexusActions {
  loadNexusFile: (file: NexusDataFile) => void;
  togglePhysical: () => void;
  toggleEconomic: () => void;
}

export type NexusStore = NexusState & NexusActions;

/* ── Store ───────────────────────────────────────────────────────────── */

export const useNexusStore = create<NexusStore>()((set) => ({
  stateNexus: {},
  countryIndex: {},
  filters: { physical: true, economic: true },

  loadNexusFile: (file) => {
    const stateNexus: NexusStateData = {};
    const countryIndex: Record<string, string[]> = {};

    for (const [countryId, countryData] of Object.entries(file)) {
      const stateIds: string[] = [];
      for (const [stateId, entry] of Object.entries(countryData.states)) {
        stateNexus[stateId] = entry;
        stateIds.push(stateId);
      }
      countryIndex[countryId] = stateIds;
    }

    set({ stateNexus, countryIndex });
  },

  togglePhysical: () =>
    set((s) => ({ filters: { ...s.filters, physical: !s.filters.physical } })),

  toggleEconomic: () =>
    set((s) => ({ filters: { ...s.filters, economic: !s.filters.economic } })),
}));

/* ── Derived selectors (pure functions, no store dependency) ─────────── */

/**
 * Check if a country is breached given the active filters.
 * A country is breached if ANY of its states has a filtered nexus type.
 */
export function isCountryBreached(
  countryId: string,
  countryIndex: Record<string, string[]>,
  stateNexus: NexusStateData,
  filters: NexusFilters,
): boolean {
  const stateIds = countryIndex[countryId];
  if (!stateIds) return false;

  for (const sid of stateIds) {
    const entry = stateNexus[sid];
    if (!entry) continue;
    if (filters.physical && entry.physical) return true;
    if (filters.economic && entry.economic) return true;
  }
  return false;
}

/**
 * Determine the nexus category for a single state entry given active filters.
 * Returns which types are active so colors can be chosen.
 */
export function getFilteredNexusCategory(
  entry: NexusEntry | undefined,
  filters: NexusFilters,
): "both" | "physical" | "economic" | "clear" {
  if (!entry) return "clear";

  const showPhysical = filters.physical && entry.physical;
  const showEconomic = filters.economic && entry.economic;

  if (showPhysical && showEconomic) return "both";
  if (showPhysical) return "physical";
  if (showEconomic) return "economic";
  return "clear";
}
