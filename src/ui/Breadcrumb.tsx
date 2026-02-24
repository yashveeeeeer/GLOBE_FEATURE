/**
 * ── Breadcrumb navigation ──────────────────────────────────────────────
 *
 * Shows the current drill path: World > Country > Subregion
 * Clicking an ancestor segment navigates back to that level.
 */

import { useSelectionStore } from "../state/selectionStore";
import { getRegionEntry } from "../data/regionIndex";

export function Breadcrumb() {
  const { selectionLevel, selectedCountryId, selectedSubregionId, goBack, resetToWorld } =
    useSelectionStore();

  const crumbs: Array<{ label: string; onClick?: () => void }> = [];

  // World is always first
  crumbs.push({
    label: "World",
    onClick: selectionLevel !== "world" ? resetToWorld : undefined,
  });

  // Country
  if (selectedCountryId) {
    const entry = getRegionEntry(selectedCountryId);
    const label = entry?.name ?? selectedCountryId;
    crumbs.push({
      label,
      onClick: selectionLevel === "subregion" ? goBack : undefined,
    });
  }

  // Subregion
  if (selectedSubregionId) {
    const entry = getRegionEntry(selectedSubregionId);
    const label = entry?.name ?? selectedSubregionId;
    crumbs.push({ label }); // leaf — no click handler
  }

  return (
    <nav className="breadcrumb" aria-label="Drill-down navigation">
      {crumbs.map((crumb, i) => (
        <span key={i} className="breadcrumb__segment">
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
}
