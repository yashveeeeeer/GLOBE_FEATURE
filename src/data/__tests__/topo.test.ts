import { describe, it, expect } from "vitest";
import { parseTopoJson } from "../topo";

// Minimal valid TopoJSON topology for testing
const MINI_TOPO = {
  type: "Topology",
  objects: {
    regions: {
      type: "GeometryCollection",
      geometries: [
        {
          type: "Polygon",
          id: "TEST1",
          properties: { id: "TEST1", name: "Test Region" },
          arcs: [[0]],
        },
      ],
    },
  },
  arcs: [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
  ],
};

describe("parseTopoJson", () => {
  it("converts a minimal topology to FeatureCollection", () => {
    const fc = parseTopoJson(MINI_TOPO);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.id).toBe("TEST1");
    expect(fc.features[0]!.properties.name).toBe("Test Region");
    expect(fc.features[0]!.geometry.type).toBe("Polygon");
  });

  it("auto-detects the first object name", () => {
    const topo = {
      ...MINI_TOPO,
      objects: {
        myData: MINI_TOPO.objects.regions,
      },
    };
    const fc = parseTopoJson(topo);
    expect(fc.features).toHaveLength(1);
  });

  it("throws on invalid input", () => {
    expect(() => parseTopoJson(null)).toThrow();
    expect(() => parseTopoJson({})).toThrow();
    expect(() => parseTopoJson({ objects: {} })).toThrow("no objects");
  });

  it("normalizes missing properties", () => {
    const topo = {
      type: "Topology",
      objects: {
        data: {
          type: "GeometryCollection",
          geometries: [
            {
              type: "Polygon",
              id: "X",
              arcs: [[0]],
              // no properties
            },
          ],
        },
      },
      arcs: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
    };
    const fc = parseTopoJson(topo);
    expect(fc.features[0]!.id).toBe("X");
    expect(fc.features[0]!.properties.id).toBe("X");
  });
});
