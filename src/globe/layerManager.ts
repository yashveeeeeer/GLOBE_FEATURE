/**
 * ── Layer Manager ──────────────────────────────────────────────────────
 *
 * Encapsulates Cesium DataSource lifecycle for region layers:
 *   - countries   : always present, outlines all countries
 *   - subregions  : swapped per selected country
 *   - highlight   : overlay for selected region
 *
 * Maintains an entity index (regionId → Entity) for O(1) lookups.
 */

import {
  type Viewer,
  GeoJsonDataSource,
  Color,
  ColorMaterialProperty,
  type Entity,
} from "cesium";
import type { RegionFeatureCollection } from "../types";
import {
  getRegionOutlineColor,
  REGION_OUTLINE_WIDTH,
  getSelectedFillColor,
  getSelectedOutlineColor,
  SELECTED_OUTLINE_WIDTH,
  getNexusBreachedColor,
  getNexusClearColor,
} from "./styles";
import { isLightTheme } from "./globeTheme";

/** Guard: viewer is alive and usable. */
function alive(v: Viewer): boolean {
  return !!v && !v.isDestroyed() && !!v.dataSources;
}

export type NexusData = Record<string, { nexus: boolean }>;

export class LayerManager {
  private viewer: Viewer;
  private countriesLayer: GeoJsonDataSource | null = null;
  private subregionsLayer: GeoJsonDataSource | null = null;
  private highlightLayer: GeoJsonDataSource | null = null;
  private entityIndex = new Map<string, Entity>();
  private nexusData: NexusData | null = null;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  /* ── Countries ───────────────────────────────────────────────────── */

  async setCountries(geo: RegionFeatureCollection): Promise<void> {
    if (!alive(this.viewer)) return;
    this.removeLayer(this.countriesLayer);

    const ds = await this.loadGeo(geo, {
      stroke: getRegionOutlineColor(isLightTheme()),
      strokeWidth: REGION_OUTLINE_WIDTH,
      fill: Color.TRANSPARENT,
    });
    if (!ds || !alive(this.viewer)) return;

    ds.name = "countries";
    this.viewer.dataSources.add(ds);
    this.countriesLayer = ds;
    this.rebuildIndex(ds);
  }

  /* ── Subregions ──────────────────────────────────────────────────── */

  async setSubregions(geo: RegionFeatureCollection, parentCountryId?: string): Promise<void> {
    if (!alive(this.viewer)) return;
    this.clearHighlight();
    this.clearSubregions();

    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    if (!alive(this.viewer)) return;

    const ds = await this.loadGeo(geo, {
      stroke: getRegionOutlineColor(isLightTheme()),
      strokeWidth: REGION_OUTLINE_WIDTH,
      fill: Color.TRANSPARENT,
    });
    if (!ds || !alive(this.viewer)) return;

    ds.name = "subregions";
    this.viewer.dataSources.add(ds);
    this.subregionsLayer = ds;
    this.rebuildIndex(ds);

    if (parentCountryId && this.nexusData) {
      const parentEntry = this.nexusData[parentCountryId];
      const color = parentEntry?.nexus ? getNexusBreachedColor() : getNexusClearColor();
      for (const entity of ds.entities.values) {
        if (entity.polygon) {
          entity.polygon.material = new ColorMaterialProperty(color);
        }
      }
    }
  }

  clearSubregions(): void {
    this.removeLayer(this.subregionsLayer);
    this.subregionsLayer = null;
  }

  /* ── Visibility toggles ───────────────────────────────────────────── */

  hideCountries(): void {
    if (this.countriesLayer) this.countriesLayer.show = false;
  }

  showCountries(): void {
    if (this.countriesLayer) this.countriesLayer.show = true;
  }

  hideSubregions(): void {
    if (this.subregionsLayer) this.subregionsLayer.show = false;
  }

  showSubregions(): void {
    if (this.subregionsLayer) this.subregionsLayer.show = true;
  }

  /* ── Highlight ───────────────────────────────────────────────────── */

  async highlight(
    regionId: string,
    geo: RegionFeatureCollection,
  ): Promise<void> {
    if (!alive(this.viewer)) return;
    this.clearHighlight();

    const feature = geo.features.find((f) => f.id === regionId);
    if (!feature) return;

    const single: RegionFeatureCollection = {
      type: "FeatureCollection",
      features: [feature],
    };

    const ds = await this.loadGeo(single, {
      stroke: getSelectedOutlineColor(),
      strokeWidth: SELECTED_OUTLINE_WIDTH,
      fill: getSelectedFillColor(),
    });
    if (!ds || !alive(this.viewer)) return;

    ds.name = "highlight";
    this.viewer.dataSources.add(ds);
    this.highlightLayer = ds;
  }

  clearHighlight(): void {
    this.removeLayer(this.highlightLayer);
    this.highlightLayer = null;
  }

  /* ── Nexus exposure coloring ─────────────────────────────────────── */

  applyNexusColors(nexusData: NexusData): void {
    this.nexusData = nexusData;
    if (!this.countriesLayer) return;
    const breached = getNexusBreachedColor();
    const clear = getNexusClearColor();

    for (const entity of this.countriesLayer.entities.values) {
      const id = entity.id;
      if (!id || !entity.polygon) continue;
      const entry = nexusData[id];
      const color = entry?.nexus ? breached : clear;
      entity.polygon.material = new ColorMaterialProperty(color);
    }
  }

  /* ── Entity lookup ───────────────────────────────────────────────── */

  getEntity(regionId: string): Entity | undefined {
    return this.entityIndex.get(regionId);
  }

  /* ── Cleanup ─────────────────────────────────────────────────────── */

  destroy(): void {
    this.clearHighlight();
    this.clearSubregions();
    this.removeLayer(this.countriesLayer);
    this.countriesLayer = null;
    this.entityIndex.clear();
  }

  /* ── Internals ───────────────────────────────────────────────────── */

  private async loadGeo(
    geo: RegionFeatureCollection,
    opts: {
      stroke: Color;
      strokeWidth: number;
      fill: Color;
    },
  ): Promise<GeoJsonDataSource | null> {
    try {
      return await GeoJsonDataSource.load(geo as never, {
        stroke: opts.stroke,
        strokeWidth: opts.strokeWidth,
        fill: opts.fill,
        clampToGround: false,
      });
    } catch (err) {
      console.error("[LayerManager] GeoJSON load error:", err);
      return null;
    }
  }

  private removeLayer(layer: GeoJsonDataSource | null): void {
    if (layer && alive(this.viewer)) {
      this.viewer.dataSources.remove(layer, true);
    }
  }

  private rebuildIndex(_ds: GeoJsonDataSource): void {
    // Clear existing entries for this data source
    // (simple approach: rebuild the whole index from all active sources)
    this.entityIndex.clear();
    for (const source of [
      this.countriesLayer,
      this.subregionsLayer,
    ]) {
      if (!source) continue;
      for (const entity of source.entities.values) {
        if (entity.id) {
          this.entityIndex.set(entity.id, entity);
        }
      }
    }
  }
}
