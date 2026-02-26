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
  selectionLevel: SelectionLevel;
  selectedCountryId: string | null;
  selectedSubregionId: string | null;
}

export interface SelectionActions {
  selectCountry: (countryId: string) => void;
  selectSubregion: (subregionId: string) => void;
  goBack: () => void;
  resetToWorld: () => void;
}

export type SelectionStore = SelectionState & SelectionActions;

/* ── URL hash helpers ────────────────────────────────────────────────── */

function stateToHash(s: SelectionState): string {
  if (s.selectedSubregionId && s.selectedCountryId)
    return `#/${s.selectedCountryId}/${s.selectedSubregionId}`;
  if (s.selectedCountryId) return `#/${s.selectedCountryId}`;
  return "#/";
}

function hashToState(): SelectionState {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (!hash) return initialState;
  const parts = hash.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return {
      selectionLevel: "subregion",
      selectedCountryId: parts[0] ?? null,
      selectedSubregionId: parts[1] ?? null,
    };
  }
  if (parts.length === 1) {
    return {
      selectionLevel: "country",
      selectedCountryId: parts[0] ?? null,
      selectedSubregionId: null,
    };
  }
  return initialState;
}

function pushHash(state: SelectionState) {
  const hash = stateToHash(state);
  if (window.location.hash !== hash) {
    history.replaceState(null, "", hash);
  }
}

/* ── Initial state ───────────────────────────────────────────────────── */

const initialState: SelectionState = {
  selectionLevel: "world",
  selectedCountryId: null,
  selectedSubregionId: null,
};

const startState = hashToState();

/* ── Store ───────────────────────────────────────────────────────────── */

export const useSelectionStore = create<SelectionStore>()((set, get) => ({
  ...startState,

  selectCountry: (countryId) => {
    const next: SelectionState = {
      selectionLevel: "country",
      selectedCountryId: countryId,
      selectedSubregionId: null,
    };
    set(next);
    pushHash(next);
  },

  selectSubregion: (subregionId) => {
    const next: SelectionState = {
      selectionLevel: "subregion",
      selectedCountryId: get().selectedCountryId,
      selectedSubregionId: subregionId,
    };
    set(next);
    pushHash(next);
  },

  goBack: () => {
    const state = get();
    let next: SelectionState;
    switch (state.selectionLevel) {
      case "subregion":
        next = {
          selectionLevel: "country",
          selectedCountryId: state.selectedCountryId,
          selectedSubregionId: null,
        };
        break;
      case "country":
        next = { ...initialState };
        break;
      default:
        return;
    }
    set(next);
    pushHash(next);
  },

  resetToWorld: () => {
    set(initialState);
    pushHash(initialState);
  },
}));

let _hashListenerAttached = false;

if (typeof window !== "undefined" && !_hashListenerAttached) {
  _hashListenerAttached = true;
  window.addEventListener("hashchange", () => {
    const fromHash = hashToState();
    const current = useSelectionStore.getState();
    if (
      fromHash.selectionLevel !== current.selectionLevel ||
      fromHash.selectedCountryId !== current.selectedCountryId ||
      fromHash.selectedSubregionId !== current.selectedSubregionId
    ) {
      useSelectionStore.setState(fromHash);
    }
  });
}
