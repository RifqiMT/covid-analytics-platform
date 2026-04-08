# Enterprise Traceability Matrix

This matrix maps requirements → implementation artifacts for auditability and change impact analysis.

| Requirement / Spec | Evidence / Implementation | Tests |
|---|---|---|
| Multi-granularity buckets (daily/weekly/monthly/quarterly/annual) | `src/lib/services/TimeSeriesAggregator.ts` | `src/lib/services/TimeSeriesAggregator.test.ts` |
| Robust date range normalization and clamping | `src/lib/dateRange.ts` | `src/lib/dateRange.test.ts` |
| Resilient upstream fetch with retries/timeouts | `src/lib/services/owidRemoteFetch.ts` | (covered indirectly) |
| Source caching (avoid repeated large downloads/parses) | `src/lib/services/owidCachedFetch.ts` | (covered indirectly) |
| API endpoint returns dashboard payload | `src/app/api/covid/route.ts` | (covered indirectly) |
| Country catalog endpoint | `src/app/api/covid/countries/route.ts` | (covered indirectly) |
| Continuous daily timeline + forward-fill + guardrails | `src/lib/services/CovidAnalyticsService.ts` | `src/lib/services/CovidAnalyticsService.fill.test.ts` |
| Recovered “no future seeding” | `src/lib/services/CovidAnalyticsService.ts` | `src/lib/services/CovidAnalyticsService.fill.test.ts` |
| Monotonic cumulative enforcement | `src/lib/services/CovidAnalyticsService.ts` | `src/lib/services/CovidAnalyticsService.fill.test.ts` |
| Rate guardrails to avoid misleading spikes | `src/lib/services/TimeSeriesAggregator.ts` | `src/lib/services/TimeSeriesAggregator.test.ts` |
| Charts view with tooltip sorting | `src/components/MetricsChart.tsx` | (manual UI validation) |
| Map performance stability | `src/components/CovidWorldMap.tsx` | (manual UI validation) |
| Table pagination + search + “All rows” | `src/components/MetricsTable.tsx` | (manual UI validation) |
| Hydration mismatch noise reduction | `src/app/layout.tsx` | (manual UI validation) |
| Reduce redundancy in refresh controls | `src/components/DashboardClient.tsx` | (manual UI validation) |

