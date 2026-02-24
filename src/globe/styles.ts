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

export const REGION_OUTLINE_WIDTH = 1.5;
export function getRegionOutlineColor(isLight: boolean): Color {
  // Keep a strong white stroke in dark mode for contrast;
  // use a deep navy stroke in light mode for readability.
  return Color.fromCssColorString(isLight ? "#1E2A44" : "#FFFFFF").withAlpha(0.9);
}

/* ── Selected region ─────────────────────────────────────────────────── */

export const SELECTED_OUTLINE_WIDTH = 3;
export function getSelectedFillColor(): Color {
  return Color.fromCssColorString(tokens().accent).withAlpha(0.15);
}
export function getSelectedOutlineColor(): Color {
  return Color.fromCssColorString(tokens().accent).withAlpha(0.9);
}

/* ── Hovered region (future) ─────────────────────────────────────────── */

export const HOVERED_OUTLINE_WIDTH = 2;
export function getHoveredFillColor(): Color {
  return Color.fromCssColorString(tokens().warning).withAlpha(0.12);
}
export function getHoveredOutlineColor(): Color {
  return Color.fromCssColorString(tokens().warning).withAlpha(0.8);
}