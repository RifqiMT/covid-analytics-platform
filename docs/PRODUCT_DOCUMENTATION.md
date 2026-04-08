# Product Documentation — COVID-19 Country Analytics Platform

## Overview
The COVID-19 Country Analytics Platform is a dashboard for exploring country-level COVID-19 metrics and derived rates from **2020 through today** (subject to upstream reporting delays). It is designed for:

- **Stability** under flaky upstream data/network conditions
- **Correctness** under real-world data issues (missing values, resets, inconsistent reporting)
- **Performance** when working with many countries and long time ranges

## Product benefits
- **Single pane of glass**: charts + map + table in one place
- **Comparable time buckets**: daily / weekly / monthly / quarterly / annually
- **Explorable at scale**: supports “all countries” and focused comparison sets
- **Transparent assumptions**: notes explain clamping, mirroring, and guardrails

## Core features
### Filters
- **Granularity**: daily, weekly (ISO), monthly, quarterly, annually
- **Date range**: `from` and `to` (ISO date)
- **Country scope**:
  - **All**: no country filter
  - **Selected**: explicit ISO-3 set, with search and bulk actions

### Views
#### Charts
- Multi-series line chart for the chosen metric
- Tooltip includes values (sorted descending) and “change vs previous period”
- In “All countries” mode, uses a performance preset: **top 15** countries (by total cases at period end)

#### Map
- Marker map for the latest bucket value in the selected range
- Uses Canvas rendering and a marker cap in “All countries” mode (top markers by absolute value)

#### Table
- Search + pagination
- “Rows per page” includes an **All** option

## Data sources
### Primary: Our World in Data (OWID)
- Source: OWID catalog compact dataset (CSV)
- Notes: OWID aggregates official reporting chains; the platform treats OWID as the primary source of truth.

### Fallback/enrichment: RifqiMT/COVID-19 (GitHub)
- Used as a best-effort enrichment source for:
  - `recovered` fields (when OWID lacks them or reports resets)
  - some geo fields (lat/lng) and population where missing

## Data processing logic (high level)
### Normalization
Raw rows are normalized into `DailyCovidObservation` (see `docs/VARIABLES.md`).

### Timeline completion & backfill
The service constructs a continuous daily timeline between `from` and `to` and applies:
- **Forward-fill** for cumulative totals (cases/deaths/recovered/vaccinations) to bridge missing reporting days
- **No backward-fill** for cumulative totals (to avoid impossible early-period ratios)
- **Backward-fill only population**
- **Monotonic cumulative enforcement**: if a cumulative total decreases, treat as missing and carry forward prior value

### Aggregation
Daily data is aggregated into `CovidMetricsBucket` based on selected granularity.

### Derived metrics & guardrails
Rates and percentages are computed with guardrails to avoid misleading spikes:
- Rate percentages return `null` when denominators are too small or logically inconsistent
- Percent values are clamped to valid bounds where appropriate

## API contract
### `GET /api/covid`

Query parameters:
- `granularity`: `daily|weekly|monthly|quarterly|annually`
- `from`: ISO date (default `2020-01-01`)
- `to`: ISO date (default today)
- `countries`: comma-separated ISO-3 list (omit for all countries)
- `mirrorLatest`: `1|0` (default `1`). When `to` exceeds upstream `dataThroughDate`, forward-fill cumulative values to `to`.
- `refresh`: `1|0` (default `0`). Bypasses caches and re-fetches source.
- `preset`: optional performance preset. Current preset: `top15` (charts-only; returns top 15 countries by total cases at period end).

Response:
- `meta`: provenance + date clamping + notes
- `countries`: country profiles + time buckets

### `GET /api/covid/countries`
Returns `{ countries: Array<{ code, name, continent? }> }` for the country selector catalog.

## Operational considerations
### Caching layers
- **Source cache** (`owidCachedFetch`):
  - in-memory TTL (10 minutes)
  - best-effort disk cache for dev restarts (`.next/cache/covid-source.json`)
- **API response cache** (`/api/covid`):
  - in-memory 30s TTL with single-flight to prevent redundant heavy work

### Performance strategy
- Prefer **focused selection** for charts & table
- Use **charts top15 preset** when “All countries” is selected
- Use **Canvas rendering and marker caps** for map in “All countries” mode

## Known limitations
- Upstream data can be revised retroactively; values may change between refreshes.
- “Recovered” reporting is inconsistent globally; enrichment is best-effort.
- Percent-based metrics have guardrails; early periods may show gaps (`null`) rather than misleading spikes.

