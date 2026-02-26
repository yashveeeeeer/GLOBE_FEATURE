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
 * Skipped in production builds for faster boot.
 */
export function validateRegionIndex(data: unknown) {
  if (import.meta.env.PROD) return data as z.infer<typeof RegionIndexSchema>;

  const result = RegionIndexSchema.safeParse(data);
  if (!result.success) {
    console.warn(
      "[schema] Region index validation warnings:",
      result.error.issues.slice(0, 5),
    );
    return data as z.infer<typeof RegionIndexSchema>;
  }
  return result.data;
}

/* ── Nexus exposure schemas ─────────────────────────────────────────── */

export const NexusEntrySchema = z.object({
  physical: z.boolean(),
  economic: z.boolean(),
});

export const NexusCountryDataSchema = z.object({
  states: z.record(z.string(), NexusEntrySchema),
});

export const NexusDataFileSchema = z.record(z.string(), NexusCountryDataSchema);

export function validateNexusData(data: unknown) {
  if (import.meta.env.PROD) return data as z.infer<typeof NexusDataFileSchema>;

  const result = NexusDataFileSchema.safeParse(data);
  if (!result.success) {
    console.warn(
      "[schema] Nexus data validation warnings:",
      result.error.issues.slice(0, 5),
    );
    return data as z.infer<typeof NexusDataFileSchema>;
  }
  return result.data;
}
