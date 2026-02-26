/**
 * ── Region Table (master-detail) with search + virtualization ──────────
 *
 * Uses react-window v2 List for large lists.
 * Search is debounced to avoid re-computing rows on every keystroke.
 * Rows include nexus status indicators when exposure data is available.
 */

import { useMemo, useCallback, useState, useEffect, useRef, memo } from "react";
import { List, type RowComponentProps } from "react-window";
import { useSelectionStore } from "../state/selectionStore";
import { useNexusStore } from "../state/nexusStore";
import { getRegionsByLevel, getRegionEntry } from "../data/regionIndex";
import {
  NEXUS_PHYSICAL_FILL,
  NEXUS_ECONOMIC_FILL,
  NEXUS_BOTH_FILL,
  NEXUS_CLEAR_FILL,
} from "../globe/styles";
import type { RegionIndexEntry, NexusStateData, NexusFilters } from "../types";

interface RegionTableProps {
  dataVersion: number;
  loading?: boolean;
}

const ROW_HEIGHT = 52;
const OVERSCAN = 8;
const DEBOUNCE_MS = 150;

interface RowData {
  rows: Array<[string, RegionIndexEntry]>;
  selectedCountryId: string | null;
  selectedSubregionId: string | null;
  onRowClick: (id: string, entry: RegionIndexEntry) => void;
  stateNexus: NexusStateData;
  countryIndex: Record<string, string[]>;
  filters: NexusFilters;
  selectionLevel: string;
}

function getNexusStatusForRow(
  id: string,
  entry: RegionIndexEntry,
  stateNexus: NexusStateData,
  countryIndex: Record<string, string[]>,
  filters: NexusFilters,
): { color: string; label: string } | null {
  if (entry.level === "country") {
    const stateIds = countryIndex[id];
    if (!stateIds) return null;
    let hasPhy = false;
    let hasEco = false;
    for (const sid of stateIds) {
      const e = stateNexus[sid];
      if (!e) continue;
      if (filters.physical && e.physical) hasPhy = true;
      if (filters.economic && e.economic) hasEco = true;
    }
    if (hasPhy && hasEco) return { color: NEXUS_BOTH_FILL, label: "Both" };
    if (hasPhy) return { color: NEXUS_PHYSICAL_FILL, label: "Physical" };
    if (hasEco) return { color: NEXUS_ECONOMIC_FILL, label: "Economic" };
    return { color: NEXUS_CLEAR_FILL, label: "Clear" };
  }

  if (entry.level === "subregion") {
    const e = stateNexus[id];
    if (!e) return null;
    const showPhy = filters.physical && e.physical;
    const showEco = filters.economic && e.economic;
    if (showPhy && showEco) return { color: NEXUS_BOTH_FILL, label: "Both" };
    if (showPhy) return { color: NEXUS_PHYSICAL_FILL, label: "Physical" };
    if (showEco) return { color: NEXUS_ECONOMIC_FILL, label: "Economic" };
    return { color: NEXUS_CLEAR_FILL, label: "Clear" };
  }

  return null;
}

function RowComponent(props: RowComponentProps<RowData>) {
  const {
    index, style, rows, selectedCountryId, selectedSubregionId,
    onRowClick, stateNexus, countryIndex, filters, selectionLevel,
  } = props;
  const item = rows[index];
  if (!item) return null;
  const [id, entry] = item;
  const isSelected =
    (entry.level === "country" && id === selectedCountryId) ||
    (entry.level === "subregion" && id === selectedSubregionId);

  const nexus = getNexusStatusForRow(id, entry, stateNexus, countryIndex, filters);
  const canDrill = entry.level === "country" && selectionLevel !== "subregion";

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
      {nexus && nexus.label !== "Clear" && (
        <span
          className="region-table__vrow-badge"
          style={{ "--badge-color": nexus.color } as React.CSSProperties}
        >
          {nexus.label}
        </span>
      )}
      {canDrill && (
        <span className="region-table__vrow-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="region-table__skeleton">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="region-table__skeleton-row" style={{ animationDelay: `${i * 60}ms` }}>
          <span className="region-table__skeleton-bar" style={{ width: `${40 + Math.random() * 35}%` }} />
          <span className="region-table__skeleton-badge" />
        </div>
      ))}
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

  const stateNexus = useNexusStore((s) => s.stateNexus);
  const countryIndex = useNexusStore((s) => s.countryIndex);
  const filters = useNexusStore((s) => s.filters);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const clearSearch = useCallback(() => {
    setSearch("");
    inputRef.current?.focus();
  }, []);

  return (
    <div className="region-table">
      <div className="region-table__search">
        <div className="region-table__search-wrap">
          <svg className="region-table__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder={`Search ${levelLabel}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="region-table__search-input"
          />
          {search && (
            <button
              type="button"
              className="region-table__search-clear"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="region-table__toolbar">
        <span className="region-table__count">
          {rows.length} {levelLabel}
        </span>
        {debouncedSearch && (
          <span className="region-table__filter-badge">filtered</span>
        )}
        {loading && <span className="region-table__spinner" />}
      </div>

      <div className="region-table__header">
        <span className="region-table__header-name">Region</span>
        <span className="region-table__header-status">Status</span>
      </div>

      <div className="region-table__body">
        {loading && rows.length === 0 ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <div className="region-table__empty">
            <div className="region-table__empty-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            {debouncedSearch ? `No ${levelLabel} match "${debouncedSearch}"` : emptyMessage}
          </div>
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
              stateNexus,
              countryIndex,
              filters,
              selectionLevel,
            }}
          />
        )}
      </div>
    </div>
  );
});
