# Architecture

## High-level flow

```mermaid
flowchart LR
  UI[DashboardClient] --> API[/api/covid]
  API --> Cache[Source cache]
  Cache --> Fetch[owidRemoteFetch]
  Fetch --> Parse[OwidCovidParser]
  Parse --> Fill[CovidAnalyticsService]
  Fill --> Agg[TimeSeriesAggregator]
  Agg --> UI
```

## Modules
### API
- `src/app/api/covid/route.ts`
  - Normalizes date range
  - Applies presets (e.g., `top15`)
  - Uses short TTL response cache + single-flight
- `src/app/api/covid/countries/route.ts`
  - Produces catalog for the country picker

### Services
- `src/lib/services/owidRemoteFetch.ts`
  - Resilient remote fetch (timeouts, retries)
  - Fallback to mirror (GitHub) and enrichment logic
- `src/lib/services/owidCachedFetch.ts`
  - Memory TTL cache
  - Best-effort disk cache across dev restarts
- `src/lib/services/CovidAnalyticsService.ts`
  - Builds continuous daily series
  - Applies fill/sanitize/monotonicity rules
  - Generates `CountrySeriesPayload[]`
- `src/lib/services/TimeSeriesAggregator.ts`
  - Buckets by granularity
  - Computes derived rates with guardrails

### UI components
- `src/components/DashboardClient.tsx`: main layout + filters + view tabs
- `src/components/MetricsChart.tsx`: Recharts line chart + tooltip growth
- `src/components/CovidWorldMap.tsx`: Leaflet map with performance caps
- `src/components/MetricsTable.tsx`: table with search/pagination

