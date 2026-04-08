# User Stories

## Epic A — Explore COVID trends by country
### Story A1 — Select time bucket and date range
**As a** user  
**I want** to choose granularity (daily/weekly/monthly/quarterly/annual) and date range  
**So that** I can view trends over the period I care about.

**Acceptance criteria**
- Granularity dropdown updates chart/table/map buckets
- Date range clamps safely and stays consistent with API response meta (`effectiveFrom`, `effectiveTo`)

### Story A2 — Compare selected countries
**As a** user  
**I want** to select a focused set of countries  
**So that** comparisons are readable and performant.

**Acceptance criteria**
- Country selector supports search, chips, and bulk actions
- Selection state is clear (All vs Selected)

## Epic B — Visualize and interpret metrics
### Story B1 — View multi-series charts
**Acceptance criteria**
- Tooltip lists series sorted by value descending
- Tooltip shows change vs previous bucket (%, bps for percent metrics)

### Story B2 — Explore map
**Acceptance criteria**
- Map renders markers for countries with geo coordinates
- In all-countries mode, map remains responsive and explains any marker caps

### Story B3 — Inspect table
**Acceptance criteria**
- Table supports search, pagination, and rows-per-page “All”
- “Focus” toggle adds/removes countries from selection

## Epic C — Trust & reliability
### Story C1 — Transparent provenance
**Acceptance criteria**
- UI displays source name, fetched time, and upstream data-through date
- Notes explain mirroring/clamping behavior

### Story C2 — Correct derived metrics
**Acceptance criteria**
- Rates follow formulas in `docs/VARIABLES.md`
- Guardrails prevent misleading spikes from tiny denominators

## Epic D — Performance and resilience
### Story D1 — Fast charts in all-countries mode
**Acceptance criteria**
- Charts request a preset that avoids heavy aggregation when no countries are selected

### Story D2 — Cache upstream data
**Acceptance criteria**
- Source fetch is cached in memory and survives dev restarts (best-effort disk cache)

