# Data Processing Scripts

This folder is reserved for Node.js scripts that process raw geographic data
into the optimised formats consumed by the app.

## Planned scripts

| Script                   | Purpose                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `build-region-index.ts`  | Walk source GeoJSON/TopoJSON files and emit `region_index.json` with bbox & centroid |
| `simplify-boundaries.ts` | Run Mapshaper to reduce vertex counts for large datasets                             |
| `convert-to-topojson.ts` | Convert GeoJSON → TopoJSON for bandwidth savings                                    |

None of these are required to run the app in development — the repository
ships with minimal sample data in `/public/data`.
