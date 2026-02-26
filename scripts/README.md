# Data Processing Scripts

This folder contains Node.js scripts that process raw geographic data
into the optimised formats consumed by the app.

## Scripts

| Script                    | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `build-data.mjs`         | Convert raw TopoJSON (adm0/adm1) → `region_index.json`, `countries.topo.json`, `subregions/*.geo.json` |
| `optimizeData.mjs`       | Split `region_index.json` into `region_index_boot.json` (countries-only); simplify `countries.topo.json` arcs |
| `fix-antimeridian.mjs`   | Fix antimeridian crossing in GeoJSON/TopoJSON geometries               |
| `sync-commenda-theme.ts` | Extract theme tokens from commenda.io via Playwright → `tokens.generated.json` |

## Usage

```bash
npm run data:build    # Runs build-data.mjs then optimizeData.mjs
npm run data:optimize # Runs optimizeData.mjs only (incremental)
npm run theme:sync    # Runs sync-commenda-theme.ts
```

None of these are required to run the app in development — the repository
ships with pre-built data in `/public/data`.
