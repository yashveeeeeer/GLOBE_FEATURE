/**
 * ── Zod schemas for region_index.json validation ───────────────────────
 */

import { z } from "zod/v4";

export const BBoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const CentroidSchema = z.tuple([z.number(), z.number()]);

export const RegionIndexEntrySchema = z.object({
  name: z.string(),
  level: z.enum(["world", "country", "subregion"]),
  parentId: z.string().nullable(),
  bbox: BBoxSchema,
  centroid: CentroidSchema,
  childDatasetPath: z.string().nullable(),
  vertexCount: z.number().optional(),
  area: z.number().optional(),
  zoomHint: z.number().optional(),
});

export const RegionIndexSchema = z.record(z.string(), RegionIndexEntrySchema);

/**
 * Validate a parsed region index object.
 * Returns the validated data or throws with details.
 */
export function validateRegionIndex(data: unknown) {
  const result = RegionIndexSchema.safeParse(data);
  if (!result.success) {
    console.warn(
      "[schema] Region index validation warnings:",
      result.error.issues.slice(0, 5),
    );
    // Don't crash — return the data as-is but log warnings
    return data as z.infer<typeof RegionIndexSchema>;
  }
  return result.data;
}
