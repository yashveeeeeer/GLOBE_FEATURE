/**
 * ── Region Table (master-detail) with search + virtualization ──────────
 *
 * Uses react-window v2 List for large lists.
 * Search filters by name (case-insensitive).
 */

import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { List } from "react-window";
import { useSelectionStore } from "../state/selectionStore";
import { getRegionsByLevel, getRegionEntry } from "../data/regionIndex";
import type { RegionIndexEntry } from "../types";

interface RegionTableProps {
  dataVersion: number;
  loading?: boolean;
}

const ROW_HEIGHT = 44;
const OVERSCAN = 5;

/* ── Row data type passed to the row component via rowProps ─────────── */
interface RowData {
  rows: Array<[string, RegionIndexEntry]>;
  selectedCountryId: string | null;
  selectedSubregionId: string | null;
  onRowClick: (id: string, entry: RegionIndexEntry) => void;
}

/* ── Row component (react-window v2: receives index, style, + rowProps) */
function RowComponent({
  index,
  style,
  ...rowProps
}: {
  index: number;
  style: React.CSSProperties;
} & RowData) {
  const { rows, selectedCountryId, selectedSubregionId, onRowClick } = rowProps;
  const item = rows[index];
  if (!item) return null;
  const [id, entry] = item;
  const isSelected =
    (entry.level === "country" && id === selectedCountryId) ||
    (entry.level === "subregion" && id === selectedSubregionId);

  return (
    <div
      style={style}
      className={`region-table__vrow ${isSelected ? "region-table__vrow--selected" : ""}`}
      onClick={() => onRowClick(id, entry)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick(id, entry);
        }
      }}
    >
      <span className="region-table__vrow-name">{entry.name}</span>
      <span className="region-table__vrow-level">{entry.level}</span>
    </div>
  );
}

export function RegionTable({ dataVersion, loading }: RegionTableProps) {
  const {
    selectionLevel,
    selectedCountryId,
    selectedSubregionId,
    selectCountry,
    selectSubregion,
  } = useSelectionStore();

  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);

  // Measure available height for the virtual list
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setListHeight(entry.contentRect.height);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── Compute rows ────────────────────────────────────────────────── */

  const { rows, emptyMessage, levelLabel } = useMemo(() => {
    void dataVersion;

    let r: Array<[string, RegionIndexEntry]> = [];
    let msg = "No data available.";
    let label = "items";

    if (selectionLevel === "world") {
      r = getRegionsByLevel("country");
      msg = "No countries loaded.";
      label = "countries";
    } else if (selectionLevel === "country" && selectedCountryId) {
      r = getRegionsByLevel("subregion", selectedCountryId);
      msg = "No subregions available for this country.";
      label = "subregions";
    } else if (selectionLevel === "subregion" && selectedSubregionId) {
      const entry = getRegionEntry(selectedSubregionId);
      r = entry ? [[selectedSubregionId, entry]] : [];
      msg = "";
      label = "subregion";
    }

    r.sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(([, e]) => e.name.toLowerCase().includes(q));
    }

    return { rows: r, emptyMessage: msg, levelLabel: label };
  }, [selectionLevel, selectedCountryId, selectedSubregionId, dataVersion, search]);

  /* ── Row click ───────────────────────────────────────────────────── */

  const handleRowClick = useCallback(
    (id: string, entry: RegionIndexEntry) => {
      if (entry.level === "country") selectCountry(id);
      else if (entry.level === "subregion") selectSubregion(id);
    },
    [selectCountry, selectSubregion],
  );

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div className="region-table">
      {/* Search */}
      <div className="region-table__search">
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="region-table__search-input"
        />
      </div>

      {/* Count + loading */}
      <div className="region-table__toolbar">
        <span className="region-table__count">
          {rows.length} {levelLabel}
        </span>
        {loading && <span className="region-table__spinner" />}
      </div>

      {/* Header */}
      <div className="region-table__header">
        <span className="region-table__header-name">Name</span>
        <span className="region-table__header-level">Level</span>
      </div>

      {/* Virtualized list */}
      <div className="region-table__body" ref={containerRef}>
        {rows.length === 0 ? (
          <div className="region-table__empty">{emptyMessage}</div>
        ) : (
          <List
            height={listHeight}
            rowCount={rows.length}
            rowHeight={ROW_HEIGHT}
            width="100%"
            overscanCount={OVERSCAN}
            rowComponent={RowComponent}
            rowProps={{
              rows,
              selectedCountryId,
              selectedSubregionId,
              onRowClick: handleRowClick,
            } satisfies RowData}
          />
        )}
      </div>
    </div>
  );
}
