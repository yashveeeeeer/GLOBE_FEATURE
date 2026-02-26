/**
 * ── Region Manifest ─────────────────────────────────────────────────────
 *
 * Virtualized jurisdiction list with monospaced status codes (PHY, ECO,
 * BTH, CLR). Hover-prefetches subregion data for instant drill-down.
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
import { prefetchDataset } from "../data/loader";
import type { RegionIndexEntry, NexusStateData, NexusFilters } from "../types";

interface RegionTableProps {
  dataVersion: number;
  loading?: boolean;
}

const ROW_HEIGHT = 44;
const OVERSCAN = 8;
const DEBOUNCE_MS = 150;

interface RowData {
  rows: Array<[string, RegionIndexEntry]>;
  selectedCountryId: string | null;
  selectedSubregionId: string | null;
  onRowClick: (id: string, entry: RegionIndexEntry) => void;
  onRowHover: (id: string, entry: RegionIndexEntry) => void;
  stateNexus: NexusStateData;
  countryIndex: Record<string, string[]>;
  filters: NexusFilters;
  selectionLevel: string;
}

function getNexusCode(
  id: string,
  entry: RegionIndexEntry,
  stateNexus: NexusStateData,
  countryIndex: Record<string, string[]>,
  filters: NexusFilters,
): { color: string; code: string } | null {
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
    if (hasPhy && hasEco) return { color: NEXUS_BOTH_FILL, code: "BTH" };
    if (hasPhy) return { color: NEXUS_PHYSICAL_FILL, code: "PHY" };
    if (hasEco) return { color: NEXUS_ECONOMIC_FILL, code: "ECO" };
    return { color: NEXUS_CLEAR_FILL, code: "CLR" };
  }

  if (entry.level === "subregion") {
    const e = stateNexus[id];
    if (!e) return null;
    const showPhy = filters.physical && e.physical;
    const showEco = filters.economic && e.economic;
    if (showPhy && showEco) return { color: NEXUS_BOTH_FILL, code: "BTH" };
    if (showPhy) return { color: NEXUS_PHYSICAL_FILL, code: "PHY" };
    if (showEco) return { color: NEXUS_ECONOMIC_FILL, code: "ECO" };
    return { color: NEXUS_CLEAR_FILL, code: "CLR" };
  }

  return null;
}

function RowComponent(props: RowComponentProps<RowData>) {
  const {
    index, style, rows, selectedCountryId, selectedSubregionId,
    onRowClick, onRowHover, stateNexus, countryIndex, filters, selectionLevel,
  } = props;
  const item = rows[index];
  if (!item) return null;
  const [id, entry] = item;
  const isSelected =
    (entry.level === "country" && id === selectedCountryId) ||
    (entry.level === "subregion" && id === selectedSubregionId);

  const nexus = getNexusCode(id, entry, stateNexus, countryIndex, filters);
  void selectionLevel;

  return (
    <div
      style={style}
      className={`manifest__row${isSelected ? " manifest__row--selected" : ""}`}
      onClick={() => onRowClick(id, entry)}
      onMouseEnter={() => onRowHover(id, entry)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick(id, entry);
        }
      }}
    >
      <span className="manifest__row-name">{entry.name}</span>
      {nexus && (
        <span className="manifest__row-code" style={{ color: nexus.color }}>
          {nexus.code}
        </span>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="manifest__skeleton">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="manifest__skeleton-row">
          <span className="manifest__skeleton-bar" style={{ width: `${35 + Math.random() * 30}%` }} />
          <span className="manifest__skeleton-code">---</span>
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
  const prevLevelRef = useRef(selectionLevel);

  useEffect(() => {
    if (prevLevelRef.current !== selectionLevel) {
      setSearch("");
      prevLevelRef.current = selectionLevel;
    }
  }, [selectionLevel]);

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

  const handleRowHover = useCallback(
    (_id: string, entry: RegionIndexEntry) => {
      if (entry.level === "country" && entry.childDatasetPath) {
        prefetchDataset(`${import.meta.env.BASE_URL}${entry.childDatasetPath}`);
      }
    },
    [],
  );

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSearch("");
      inputRef.current?.blur();
    }
  }, []);

  return (
    <div className="manifest">
      <div className="manifest__search">
        <input
          ref={inputRef}
          type="text"
          placeholder={`SEARCH ${levelLabel.toUpperCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="manifest__search-input"
        />
      </div>

      <div className="manifest__header">
        <span className="manifest__header-col">JURISDICTION</span>
        <span className="manifest__header-col manifest__header-col--right">STATUS</span>
      </div>

      <div className="manifest__toolbar">
        <span className="manifest__count">
          {rows.length} {levelLabel}
        </span>
        {debouncedSearch && <span className="manifest__filtered">FILTERED</span>}
        {loading && <span className="manifest__spinner" />}
      </div>

      <div className="manifest__body">
        {loading && rows.length === 0 ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <div className="manifest__empty">
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
              onRowHover: handleRowHover,
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
