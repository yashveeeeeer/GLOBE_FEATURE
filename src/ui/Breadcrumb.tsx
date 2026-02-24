/**
 * ── Breadcrumb navigation ──────────────────────────────────────────────
 *
 * Shows the current drill path: World > Country > Subregion
 * Clicking an ancestor segment navigates back to that level.
 */

import { memo } from "react";
import { useSelectionStore } from "../state/selectionStore";
import { getRegionEntry } from "../data/regionIndex";

export const Breadcrumb = memo(function Breadcrumb() {
  const { selectionLevel, selectedCountryId, selectedSubregionId, goBack, resetToWorld } =
    useSelectionStore();

  const crumbs: Array<{ key: string; label: string; onClick?: () => void }> = [];

  crumbs.push({
    key: "world",
    label: "World",
    onClick: selectionLevel !== "world" ? resetToWorld : undefined,
  });

  if (selectedCountryId) {
    const entry = getRegionEntry(selectedCountryId);
    crumbs.push({
      key: selectedCountryId,
      label: entry?.name ?? selectedCountryId,
      onClick: selectionLevel === "subregion" ? goBack : undefined,
    });
  }

  if (selectedSubregionId) {
    const entry = getRegionEntry(selectedSubregionId);
    crumbs.push({
      key: selectedSubregionId,
      label: entry?.name ?? selectedSubregionId,
    });
  }

  return (
    <nav className="breadcrumb" aria-label="Drill-down navigation">
      {crumbs.map((crumb, i) => (
        <span key={crumb.key} className="breadcrumb__segment">
          {i > 0 && <span className="breadcrumb__sep"> › </span>}
          {crumb.onClick ? (
            <button
              type="button"
              className="breadcrumb__link"
              onClick={crumb.onClick}
            >
              {crumb.label}
            </button>
          ) : (
            <span className="breadcrumb__current">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
});
