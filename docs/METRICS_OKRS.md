# Product Metrics & OKRs

## Product metrics (analytics for the product team)

### Adoption & engagement
- **DAU/WAU/MAU**
  - Definition: unique users per day/week/month
  - Target: establish baseline → +20% MoM in early rollout
- **Dashboard sessions**
  - Definition: sessions that load `/` and request `/api/covid`
- **Time-to-first-insight**
  - Definition: time from page load to first chart/table render with data
  - Target: < 2s when caches are warm

### Performance & reliability
- **API p95 latency (`/api/covid`)**
  - Target: < 1.5s for focused sets; < 3s for “all countries” requests after cache
- **Source fetch success rate**
  - Target: > 99% (with cache fallback); monitor network failures
- **Error overlay rate (dev)**
  - Target: near zero in typical navigation (excluding browser extensions)

### Data quality
- **Monotonicity violations detected**
  - Definition: count of days where cumulative totals decrease before sanitization
  - Target: 0 after fill logic
- **Recovered availability coverage**
  - Definition: % countries with non-null recovered in latest bucket
  - Target: improve via enrichment and sanitization

## OKRs (example)

### Objective 1 — Make the dashboard fast and dependable
- **KR1**: Reduce warm-cache p95 `/api/covid` latency by 30%
- **KR2**: Eliminate recurring runtime overlays during normal use
- **KR3**: Achieve 0 known data-integrity regressions in derived metrics (via tests)

### Objective 2 — Increase clarity and trust
- **KR1**: Every derived metric has a documented formula and example in `docs/VARIABLES.md`
- **KR2**: Provenance is visible (source, fetched time, data-through date, mirroring note)

