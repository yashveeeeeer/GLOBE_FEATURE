/**
 * ── Selection Store (Zustand) ──────────────────────────────────────────
 *
 * Centralised app state for the drill-down selection tree.
 *
 * Responsibilities:
 *  - Track current drill level and selected IDs.
 *  - Provide actions for drilling in and backing out.
 *  - Keep a stable API so consumers don't depend on internal shape.
 */

import { create } from "zustand";
import type { SelectionLevel } from "../types";

/* ── State shape ─────────────────────────────────────────────────────── */

export interface SelectionState {
  /** Current drill level */
  selectionLevel: SelectionLevel;
  /** Currently selected country ID, or null when at world level */
  selectedCountryId: string | null;
  /** Currently selected subregion ID, or null when above subregion level */
  selectedSubregionId: string | null;
}

export interface SelectionActions {
  /** Select a country — drills from world → country */
  selectCountry: (countryId: string) => void;
  /** Select a subregion — drills from country → subregion */
  selectSubregion: (subregionId: string) => void;
  /** Go back one level (subregion → country → world) */
  goBack: () => void;
  /** Reset to world view */
  resetToWorld: () => void;
}

export type SelectionStore = SelectionState & SelectionActions;

/* ── Initial state ───────────────────────────────────────────────────── */

const initialState: SelectionState = {
  selectionLevel: "world",
  selectedCountryId: null,
  selectedSubregionId: null,
};

/* ── Store ───────────────────────────────────────────────────────────── */

export const useSelectionStore = create<SelectionStore>()((set) => ({
  ...initialState,

  selectCountry: (countryId) =>
    set({
      selectionLevel: "country",
      selectedCountryId: countryId,
      selectedSubregionId: null,
    }),

  selectSubregion: (subregionId) =>
    set({
      selectionLevel: "subregion",
      selectedSubregionId: subregionId,
    }),

  goBack: () =>
    set((state) => {
      switch (state.selectionLevel) {
        case "subregion":
          return {
            selectionLevel: "country" as const,
            selectedSubregionId: null,
          };
        case "country":
          return { ...initialState };
        default:
          return {};
      }
    }),

  resetToWorld: () => set(initialState),
}));
