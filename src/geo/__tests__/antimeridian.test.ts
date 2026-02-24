import { describe, it, expect } from "vitest";
import { normalizeBBox, padBBox } from "../antimeridian";

describe("normalizeBBox", () => {
  it("returns normal bbox unchanged", () => {
    const bbox = normalizeBBox([10, 20, 50, 60]);
    expect(bbox).toEqual([10, 20, 50, 60]);
  });

  it("swaps west/east when span > 180 (antimeridian)", () => {
    // USA: [-178, 18, 179, 71] → span=357° → should swap
    const bbox = normalizeBBox([-178, 18, 179, 71]);
    expect(bbox[0]).toBe(179);   // west = old east
    expect(bbox[2]).toBe(-178);  // east = old west
  });

  it("clamps latitude to ±89.99", () => {
    const bbox = normalizeBBox([0, -100, 10, 100]);
    expect(bbox[1]).toBeCloseTo(-89.99);
    expect(bbox[3]).toBeCloseTo(89.99);
  });

  it("does not swap when span is exactly 180", () => {
    const bbox = normalizeBBox([0, 0, 180, 45]);
    expect(bbox[0]).toBe(0);
    expect(bbox[2]).toBe(180);
  });
});

describe("padBBox", () => {
  it("applies 10% padding", () => {
    const padded = padBBox([10, 20, 30, 40], 0.1);
    expect(padded[0]).toBe(8);   // 10 - 2
    expect(padded[1]).toBe(18);  // 20 - 2
    expect(padded[2]).toBe(32);  // 30 + 2
    expect(padded[3]).toBe(42);  // 40 + 2
  });

  it("clamps south to -89.99", () => {
    const padded = padBBox([0, -89, 10, 0], 0.5);
    expect(padded[1]).toBeCloseTo(-89.99);
  });

  it("clamps north to 89.99", () => {
    const padded = padBBox([0, 0, 10, 89], 0.5);
    expect(padded[3]).toBeCloseTo(89.99);
  });
});
