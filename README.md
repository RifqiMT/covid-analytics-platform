# COVID-19 Country Analytics Platform

Product-grade dashboard for exploring **COVID-19 country metrics** from **2020 → today** with **tables, charts, and maps**, optimized for stability and performance on large datasets.

## What this product does

- **Compare countries** across time (daily/weekly/monthly/quarterly/annual buckets)
- **Inspect metrics**: cases, deaths, recovered, vaccinations, and derived rates
- **Explore visually**:
  - **Charts** (multi-series time lines)
  - **Map** (marker-based geo view for latest bucket)
  - **Table** (search + pagination, with “All rows” option)

## Primary users (who this is for)

- Product & strategy teams comparing country-level trends
- Data analysts validating public-health trends
- Engineers needing a resilient reference implementation for large, messy public datasets

## Data sources & provenance

- **Primary**: Our World in Data (OWID) catalog compact dataset (CSV)
- **Fallback / enrichment**: RifqiMT/COVID-19 (JHU CSSE-style time series) used to enrich **recovered** and geo fields when missing

See `docs/PRODUCT_DOCUMENTATION.md` for details, assumptions, and limitations.

## Tech stack

- **Next.js (App Router)** + **React 18** + **TypeScript**
- **Tailwind CSS** (Indonesia-inspired palette tokens)
- **Recharts** (charts), **Leaflet + react-leaflet** (map)
- **date-fns**, `csv-parse`, `world-countries`

## Key architecture (high level)

- **API routes**:
  - `GET /api/covid` returns dashboard payload
  - `GET /api/covid/countries` returns country catalog
- **Services**:
  - `owidRemoteFetch` (resilient fetch + fallbacks)
  - `owidCachedFetch` (memory cache + best-effort disk cache)
  - `CovidAnalyticsService` (normalize, fill, derive, bucket)
  - `TimeSeriesAggregator` (bucket aggregation + rate guardrails)

## Run locally

```bash
cd covid-analytics-platform
npm install
npm run dev:clean
```

Open `http://localhost:3000`.

## Common operations

- **Clean restart** (recommended after config/dependency changes):

```bash
npm run dev:clean
```

- **Test**:

```bash
npm test
```

- **Build**:

```bash
npm run build
```

## API (public contract)

| Endpoint | Purpose |
|---|---|
| `GET /api/covid/countries` | ISO code + name list for country selection. |
| `GET /api/covid?granularity=&from=&to=&countries=&refresh=&mirrorLatest=&preset=` | Dashboard payload. `countries` = comma-separated ISO-3. `refresh=1` bypasses cache. `mirrorLatest=1` forward-fills to “today”. `preset=top15` returns top 15 countries for charts performance. |

## Documentation

- **Product docs**: `docs/PRODUCT_DOCUMENTATION.md`
- **PRD**: `docs/PRD.md`
- **User personas**: `docs/personas/`
- **User stories**: `docs/user-stories/`
- **Variables & formulas**: `docs/VARIABLES.md`
- **Metrics & OKRs**: `docs/METRICS_OKRS.md`
- **Design guidelines**: `docs/DESIGN_GUIDELINES.md`
- **Traceability matrix**: `docs/TRACEABILITY_MATRIX.md`
- **Guardrails**: `docs/GUARDRAILS.md`
- **Changelog**: `docs/CHANGELOG.md`
