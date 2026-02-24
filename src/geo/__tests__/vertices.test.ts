import { describe, it, expect } from "vitest";
import { extractVertices } from "../vertices";
import type { GeoJsonGeometry } from "../../types";

describe("extractVertices", () => {
  it("extracts vertices from a simple Polygon", () => {
    const geom: GeoJsonGeometry = {
      type: "Polygon",
      coordinates: [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      ],
    };
    const verts = extractVertices(geom);
    expect(verts).toHaveLength(5);
    expect(verts[0]).toEqual([0, 0]);
    expect(verts[4]).toEqual([0, 0]);
  });

  it("extracts vertices from a MultiPolygon", () => {
    const geom: GeoJsonGeometry = {
      type: "MultiPolygon",
      coordinates: [
        [[[0, 0], [1, 0], [1, 1], [0, 0]]],
        [[[10, 10], [11, 10], [11, 11], [10, 10]]],
      ],
    };
    const verts = extractVertices(geom);
    expect(verts).toHaveLength(8); // 4 + 4
  });

  it("handles GeometryCollection", () => {
    const geom: GeoJsonGeometry = {
      type: "GeometryCollection",
      coordinates: undefined as never,
      geometries: [
        {
          type: "Polygon",
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
        },
        {
          type: "Polygon",
          coordinates: [[[5, 5], [6, 5], [6, 6], [5, 5]]],
        },
      ],
    };
    const verts = extractVertices(geom);
    expect(verts).toHaveLength(8);
  });

  it("samples when vertex count exceeds maxCount", () => {
    // Create a polygon with 1000 vertices
    const ring: number[][] = [];
    for (let i = 0; i < 1000; i++) {
      ring.push([i * 0.1, Math.sin(i * 0.01)]);
    }
    ring.push(ring[0]!); // close ring

    const geom: GeoJsonGeometry = {
      type: "Polygon",
      coordinates: [ring],
    };

    const verts = extractVertices(geom, 100);
    expect(verts.length).toBeLessThanOrEqual(100);
    expect(verts.length).toBeGreaterThan(0);
  });

  it("returns empty array for null/empty geometry", () => {
    const geom: GeoJsonGeometry = { type: "Polygon", coordinates: [] };
    expect(extractVertices(geom)).toEqual([]);
  });
});
