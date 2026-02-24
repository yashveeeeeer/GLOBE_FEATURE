# Globe Drilldown

Interactive 3D globe with hierarchical region drill-down. Click a country to zoom in and see its subregions — all driven by local GeoJSON/TopoJSON data.

---

## Quick Start

```bash
npm install
npm run dev
```

Open the URL printed by Vite (e.g. `http://localhost:5173`).

**If you see "Connection failed" or "This site can't be reached"** in the browser, the dev server is not running. Run `npm run dev` (or `.\start-dev.ps1` on Windows) first, then open `http://localhost:5173`. Do not open the app by double-clicking `index.html` (use the dev server URL).

---

## Architecture

```
src/
├── App.tsx                   # Root component — boot, selection, layout
├── App.css                   # Global styles (dark theme, layout)
├── main.tsx                  # Entry point (no StrictMode — Cesium compat)
├── types.ts                  # Shared TS types (BBox, RegionIndex, etc.)
├── data/
│   ├── regionIndex.ts        # Load + query region_index.json
│   ├── loader.ts             # Unified dataset loader (LRU cache, TopoJSON/GeoJSON)
│   ├── topo.ts               # TopoJSON → GeoJSON parser (topojson-client)
│   └── schema.ts             # Zod validation for region_index.json
├── geo/
│   ├── antimeridian.ts       # Bbox normalization, centroid, padding
│   └── vertices.ts           # Extract + sample polygon vertices
├── globe/
│   ├── createViewer.ts       # Cesium Viewer factory (offline, no UI chrome)
│   ├── layerManager.ts       # Layer lifecycle: countries, subregions, highlight
│   ├── focus.ts              # Camera flights: bbox / bounding-sphere / auto
│   ├── autorotate.ts         # Idle spin with pause/resume
│   ├── styles.ts             # Centralized outline/fill/highlight colors
│   └── index.ts              # Barrel exports
├── state/
│   └── selectionStore.ts     # Zustand store: drill-down state + actions
└── ui/
    ├── RegionTable.tsx        # Virtualized table with search (react-window)
    ├── Breadcrumb.tsx         # World > Country > Subregion navigation
    └── ErrorBanner.tsx        # Friendly error display with retry
```

### Data Flow

```
region_index.json (metadata)  ──→  regionIndex.ts  ──→  Table + Focus
countries.topo.json           ──→  loader.ts        ──→  topo.ts  ──→  LayerManager
subregions/{id}.geo.json      ──→  loader.ts (lazy)  ──→  LayerManager
```

---

## Data Pipeline

### Input Files (project root)

| File | Description |
|------|-------------|
| `world_adm0_commenda.topojson` | Country boundaries (adm0) |
| `world_adm1_commenda.topojson` | Subregion boundaries (adm1) |

### Build Command

```bash
npm run data:build
```

Generates:

```
public/data/
├── region_index.json         # Metadata: bbox, centroid, area, vertexCount, zoomHint
├── countries.topo.json       # Cleaned adm0 TopoJSON (served to browser)
├── countries.geo.json        # GeoJSON fallback
└── subregions/
    ├── US.geo.json           # Per-country subregion GeoJSON
    ├── IN.geo.json
    └── ... (224 files)
```

### `region_index.json` Schema

```jsonc
{
  "US": {
    "name": "United States of America",
    "level": "country",
    "parentId": null,
    "bbox": [-125.0, 24.5, -66.9, 49.4],
    "centroid": [-98.5, 39.8],
    "childDatasetPath": "/data/subregions/US.geo.json",
    "vertexCount": 1234,
    "area": 695.92,
    "zoomHint": 9
  }
}
```

**The app runs without executing the build script** — pre-built data ships in `public/data/`.

---

## Camera Focus Modes

`focusToRegion(viewer, regionId, opts?)` supports three modes:

| Mode | Strategy | When used |
|------|----------|-----------|
| `"auto"` (default) | Try bounding-sphere from polygon vertices; fall back to bbox | Always |
| `"sphere"` | Compute BoundingSphere from sampled vertices (up to 500) | When geometry is available |
| `"bbox"` | Fly to Cesium Rectangle from region_index bbox | Fast fallback |

All modes handle antimeridian crossing (US, Russia, NZ, Fiji, Kiribati).

---

## Performance

- **LRU cache** (20 entries) in `loader.ts` — revisiting a country is instant
- **Lazy loading** — subregion data fetched only on country selection
- **Virtualized table** — react-window handles 237+ rows smoothly
- **Large file warning** — datasets > 5MB trigger a console warning
- **TopoJSON** — countries served as TopoJSON (~769KB vs ~3.7MB GeoJSON)
- **Vertex sampling** — bounding-sphere computed from max 500 sampled points

---

## Theme System

The app uses a token-driven design system aligned with Commenda's brand.

### Token Architecture

```
src/theme/
├── tokens.ts              # Default Commenda palette (source of truth)
├── tokens.generated.json  # Optional: overrides from commenda.io sync
├── resolveTokens.ts       # Merges generated over defaults
├── injectTokens.ts        # Writes tokens as CSS vars at boot
└── theme.css              # Fallback :root vars + light theme (prepared)
```

### How tokens work

1. `tokens.ts` defines the default palette (dark navy, blue accent, Inter font)
2. At boot, `injectTokens.ts` reads resolved tokens and writes CSS custom properties
3. All CSS uses `var(--bg)`, `var(--accent)`, etc. — zero hardcoded hex
4. Cesium globe styles also derive from resolved tokens

### Syncing from commenda.io

```bash
npm run theme:sync
```

Uses Playwright to open commenda.io, extract computed styles (background, CTA button, fonts, borders), and write `src/theme/tokens.generated.json`. The app loads these if present, otherwise uses defaults.

### Overriding tokens safely

Edit `src/theme/tokens.ts` to change defaults, or create `src/theme/tokens.generated.json` manually:

```json
{
  "accent": "#10B981",
  "bg": "#0A0A0A"
}
```

Only the keys you include are overridden; everything else keeps the default.

### Available CSS variables

| Variable | Purpose |
|----------|---------|
| `--bg` | Page background |
| `--surface-1`, `--surface-2` | Panel/card backgrounds |
| `--surface-hover` | Hover state |
| `--text-1`, `--text-2`, `--muted` | Text hierarchy |
| `--border`, `--ring` | Borders, focus rings |
| `--accent`, `--accent-hover`, `--accent-contrast` | Primary action color |
| `--danger`, `--warning`, `--success` | Semantic colors |
| `--radius`, `--radius-sm`, `--radius-lg` | Border radii |
| `--font-family`, `--font-heading` | Typography |

---

## Scripts

```bash
npm run dev          # Vite dev server
npm run build        # Type-check + production build
npm run preview      # Preview production build
npm run test         # Run Vitest unit tests
npm run test:watch   # Vitest in watch mode
npm run data:build   # Regenerate public/data/ from raw TopoJSON
npm run theme:sync   # Extract theme from commenda.io (requires Playwright)
npm run lint         # ESLint
npm run format       # Prettier
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + TypeScript 5.7 |
| Build | Vite 6 |
| Globe | CesiumJS 1.138 |
| State | Zustand 5 |
| Theme | Token-driven CSS vars |
| TopoJSON | topojson-client 3 |
| Virtualization | react-window |
| Validation | Zod 4 |
| Testing | Vitest 4 |
| Theme Sync | Playwright |
