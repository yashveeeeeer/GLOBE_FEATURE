/**
 * ── Centralized visual styles for globe entities ───────────────────────
 *
 * Derives Cesium Color values from the resolved theme tokens so globe
 * outlines/fills match the UI theme. Themeable without touching render code.
 */

import { Color } from "cesium";
import { resolveTokens } from "../theme/resolveTokens";

function tokens() {
  return resolveTokens();
}

/* ── Region outline ──────────────────────────────────────────────────── */

export const REGION_OUTLINE_WIDTH = 2.0;
export function getRegionOutlineColor(isLight: boolean): Color {
  return Color.fromCssColorString(isLight ? "#1a1a2e" : "#FFFFFF").withAlpha(1.0);
}

/* ── Selected region ─────────────────────────────────────────────────── */

export const SELECTED_OUTLINE_WIDTH = 3;
export function getSelectedFillColor(): Color {
  return Color.fromCssColorString(tokens().accent).withAlpha(0.15);
}
export function getSelectedOutlineColor(): Color {
  return Color.fromCssColorString(tokens().accent).withAlpha(0.9);
}

/* ── Nexus exposure (multi-type) ──────────────────────────────────── */

export const NEXUS_PHYSICAL_FILL = "#8B5CF6";
export const NEXUS_ECONOMIC_FILL = "#F59E0B";
export const NEXUS_BOTH_FILL = "#EF4444";
export const NEXUS_CLEAR_FILL = "#22C55E";

const NEXUS_ACTIVE_ALPHA = 0.35;
const NEXUS_CLEAR_ALPHA = 0.15;

export type NexusCategory = "both" | "physical" | "economic" | "clear";

const NEXUS_CATEGORY_MAP: Record<NexusCategory, { fill: string; alpha: number }> = {
  physical: { fill: NEXUS_PHYSICAL_FILL, alpha: NEXUS_ACTIVE_ALPHA },
  economic: { fill: NEXUS_ECONOMIC_FILL, alpha: NEXUS_ACTIVE_ALPHA },
  both:     { fill: NEXUS_BOTH_FILL,     alpha: NEXUS_ACTIVE_ALPHA },
  clear:    { fill: NEXUS_CLEAR_FILL,    alpha: NEXUS_CLEAR_ALPHA },
};

export function getNexusCategoryColor(category: NexusCategory): Color {
  const { fill, alpha } = NEXUS_CATEGORY_MAP[category];
  return Color.fromCssColorString(fill).withAlpha(alpha);
}