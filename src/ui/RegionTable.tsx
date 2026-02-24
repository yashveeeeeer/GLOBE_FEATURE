/**
 * ── Region Table (master-detail) with search + virtualization ──────────
 *
 * Uses react-window v2 List for large lists.
 * Search is debounced to avoid re-computing rows on every keystroke.
 */

import { useMemo, useCallback, useState, useEffect, useRef, memo } from "react";
import { List, type RowComponentProps } from "react-window";
import { useSelectionStore } from "../state/selectionStore";
import { getRegionsByLevel, getRegionEntry } from "../data/regionIndex";
import type { RegionIndexEntry } from "../types";

interface RegionTableProps {
  dataVersion: number;
  loading?: boolean;
}

const ROW_HEIGHT = 44;
const OVERSCAN = 5;
const DEBOUNCE_MS = 200;

interface RowData {
  rows: Array<[string, RegionIndexEntry]>;
  selectedCountryId: string | null;
  selectedSubregionId: string | null;
  onRowClick: (id: string, entry: RegionIndexEntry) => void;
}

function RowComponent(props: RowComponentProps<RowData>) {
  const { index, style, rows, selectedCountryId, selectedSubregionId, onRowClick } = props;
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

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timerRef.current);
  }, [value, delay]);

  return debounced;
}

export const RegionTable = memo(function RegionTable({ dataVersion, loading }: RegionTableProps) {
  const {
    selectionLevel,
    selectedCountryId,
    selectedSubregionId,
    selectCountry,
    selectSubregion,
  } = useSelectionStore();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS);

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

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      r = r.filter(([, e]) => e.name.toLowerCase().includes(q));
    }

    return { rows: r, emptyMessage: msg, levelLabel: label };
  }, [selectionLevel, selectedCountryId, selectedSubregionId, dataVersion, debouncedSearch]);

  const handleRowClick = useCallback(
    (id: string, entry: RegionIndexEntry) => {
      if (entry.level === "country") selectCountry(id);
      else if (entry.level === "subregion") selectSubregion(id);
    },
    [selectCountry, selectSubregion],
  );

  return (
    <div className="region-table">
      <div className="region-table__search">
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="region-table__search-input"
        />
      </div>

      <div className="region-table__toolbar">
        <span className="region-table__count">
          {rows.length} {levelLabel}
        </span>
        {loading && <span className="region-table__spinner" />}
      </div>

      <div className="region-table__header">
        <span className="region-table__header-name">Name</span>
        <span className="region-table__header-level">Level</span>
      </div>

      <div className="region-table__body">
        {rows.length === 0 ? (
          <div className="region-table__empty">{emptyMessage}</div>
        ) : (
          <List
            rowCount={rows.length}
            rowHeight={ROW_HEIGHT}
            overscanCount={OVERSCAN}
            rowComponent={RowComponent}
            rowProps={{
              rows,
              selectedCountryId,
              selectedSubregionId,
              onRowClick: handleRowClick,
            }}
          />
        )}
      </div>
    </div>
  );
});
