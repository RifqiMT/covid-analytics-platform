# PRD — COVID-19 Country Analytics Platform

## 1. Problem statement
Teams need a reliable way to explore country-level COVID-19 metrics and rates from 2020 to today. Public datasets are large and messy (missing days, inconsistent recovered reporting, sudden resets), and typical dashboards fail under real-world conditions (network flakiness, stale build artifacts, poor performance at “all countries” scale).

## 2. Goals
- Provide an interactive dashboard with **Charts / Map / Table**.
- Support **daily → annual** time buckets.
- Provide **clear, correct formulas** for derived metrics (rates, percentages).
- Maintain **stability** under:
  - flaky upstream networks
  - large payloads
  - dev-server hot reload issues
- Keep performance acceptable for “all countries” exploration.

## 3. Non-goals
- Clinical decision support.
- Predictive modeling / forecasting.
- Guaranteeing official ground truth beyond upstream sources.

## 4. Users & use cases
Primary personas (see `docs/personas/`):
- Product Analyst: compare trends across a handful of countries
- Public Health Researcher: validate trend shapes and rates
- Engineer: reference implementation for resilient data ingestion & visualization

Key use cases:
- Compare country metrics over time across selected time buckets
- Identify outliers on maps and drill into country details
- Export insights by reading table values or using browser screenshots (no CSV export in current scope)

## 5. Requirements
### Functional requirements
- **Filters**
  - Select time granularity
  - Select date range (`from`, `to`)
  - Select countries (All vs Selected)
- **Metrics**
  - New cases/deaths/recovered (period sums)
  - Total cases/deaths/recovered (period end)
  - Cases/deaths/recovered per 100k
  - Infected %, Recovery %, Mortality %, Vaccinated %
  - Tooltip growth vs previous period (%, bps for % metrics)
- **Views**
  - Charts: multi-series time chart; tooltip sorted descending by value
  - Map: markers for latest bucket in range; stable lifecycle; performance caps in all-countries mode
  - Table: pagination, search, “rows per page: All”
- **Data**
  - Primary source: OWID catalog CSV
  - Fallback/enrichment: RifqiMT/COVID-19 JHU-style series (recovered & geo enrichment)
  - Mirror latest: forward-fill to `to` when beyond upstream data-through date

### Non-functional requirements
- **Performance**
  - Avoid aggregating/rendering unnecessary full-country series for charts when not focused
  - Cache heavy computations and upstream downloads
- **Reliability**
  - Defensive parsing, graceful degradation, meaningful error messages
  - Resilience against dev-only issues (stale chunks, hydration noise, Leaflet double-init)
- **Accessibility**
  - Keyboard-friendly controls; correct ARIA semantics for toggles/buttons

## 6. Success metrics (product)
- Dashboard first usable render after warm cache: < 2s on typical dev machine
- Error overlays in normal navigation: ~0 (excluding external extensions)
- “All countries” chart interaction latency: < 500ms (after cache)

## 7. Data definitions (summary)
See `docs/VARIABLES.md` for exhaustive definitions and formulas.

## 8. Release plan (incremental)
- R1: stable core dashboard + caching + correct derived metrics
- R2: performance presets for charts/map/table + improved UX polish
- R3: export/reporting features (optional)

