# Variables, Metrics & Formulas

This document defines the core variables and how they relate across the data pipeline and UI.

## Data pipeline (where variables live)
- **Raw source rows**: `src/lib/services/OwidCovidParser.ts` (`OwidRawDay`, `OwidRawBlock`)
- **Normalized day**: `src/lib/types/covid.ts` (`DailyCovidObservation`)
- **Filled daily series**: `src/lib/services/CovidAnalyticsService.ts` (`completeAndFillDailySeries`)
- **Aggregated bucket**: `src/lib/types/covid.ts` (`CovidMetricsBucket`)
- **Charts/Map/Table**: `src/components/*`

## Variable dictionary

| Variable name | Friendly name | Definition | Formula | Location in app | Example |
|---|---|---|---|---|---|
| `date` | Date | ISO date for the observation | — | `DailyCovidObservation.date` | `2021-08-17` |
| `newCases` | New cases | Daily new cases | from OWID `new_cases` or delta(total) | `DailyCovidObservation.newCases` | `1523` |
| `totalCases` | Total cases | Cumulative confirmed cases | from OWID `total_cases` (forward-filled, monotonic) | `DailyCovidObservation.totalCases` | `1_234_567` |
| `newDeaths` | New deaths | Daily new deaths | from OWID `new_deaths` or delta(total) | `DailyCovidObservation.newDeaths` | `12` |
| `totalDeaths` | Total deaths | Cumulative deaths | from OWID `total_deaths` (forward-filled, monotonic) | `DailyCovidObservation.totalDeaths` | `12_345` |
| `newRecovered` | New recovered | Daily new recovered | from OWID/mirror `new_recovered` or delta(total) | `DailyCovidObservation.newRecovered` | `98` |
| `totalRecovered` | Total recovered | Cumulative recovered | from OWID/mirror `total_recovered` (forward-filled, monotonic; no future seeding) | `DailyCovidObservation.totalRecovered` | `987_654` |
| `population` | Population | Population for denominator metrics | OWID population (backfilled only) | `DailyCovidObservation.population` / `CountryProfile.population` | `273_523_621` |
| `peopleVaccinated` | People vaccinated | Cumulative people with ≥ 1 dose | OWID `people_vaccinated` (monotonic forward-fill) | `DailyCovidObservation.peopleVaccinated` | `50_000_000` |
| `granularity` | Granularity | Bucket granularity | `daily|weekly|monthly|quarterly|annually` | `CovidMetricsBucket.granularity` | `monthly` |
| `newCasesSum` | New cases (bucket) | Sum of new cases in a bucket | \(\sum newCases\) | `TimeSeriesAggregator.toBucket` | `15_000` |
| `totalCasesEnd` | Cases (period end) | Latest cumulative cases inside bucket | last day’s `totalCases` | `CovidMetricsBucket.totalCasesEnd` | `1_000_000` |
| `infectionRatePer100k` | Cases / 100k | New cases per 100k in bucket | \((newCasesSum / populationEnd) * 100000\) | `CovidMetricsBucket.infectionRatePer100k` | `12.3` |
| `infectionRatePercent` | Infected (%) | Cumulative cases share of population at period end | \((totalCasesEnd / populationEnd) * 100\) | `CovidMetricsBucket.infectionRatePercent` | `4.56` |
| `deathRatePer100k` | Deaths / 100k | New deaths per 100k in bucket | \((newDeathsSum / populationEnd) * 100000\) | `CovidMetricsBucket.deathRatePer100k` | `0.45` |
| `recoveryRatePer100k` | Recovered / 100k | New recovered per 100k in bucket | \((newRecoveredSum / populationEnd) * 100000\) | `CovidMetricsBucket.recoveryRatePer100k` | `3.2` |
| `recoveryRatePercent` | Recovery rate (%) | Cumulative recovered divided by cumulative cases (%) | \((totalRecoveredEnd / totalCasesEnd) * 100\) with guardrails | `CovidMetricsBucket.recoveryRatePercent` | `97.1` |
| `mortalityRatePercent` | Mortality rate (%) | Cumulative deaths divided by cumulative cases (%) | \((totalDeathsEnd / totalCasesEnd) * 100\) with guardrails | `CovidMetricsBucket.mortalityRatePercent` | `1.7` |
| `vaccinationRatePercent` | Vaccinated (%) | Cumulative vaccinated share of population (%) | \((peopleVaccinatedEnd / populationEnd) * 100\) | `CovidMetricsBucket.vaccinationRatePercent` | `62.4` |

### Guardrails (important)
Percent rates (`recoveryRatePercent`, `mortalityRatePercent`) return `null` if:
- `totalCasesEnd` is too small (denominator noise threshold)
- numerator > denominator (logically inconsistent)

See `src/lib/services/TimeSeriesAggregator.ts`.

## Relationship chart (Mermaid)

```mermaid
flowchart LR
  A[OWID Catalog CSV / Mirror CSV] --> B[OwidCovidParser.normalizeDay]
  B --> C[DailyCovidObservation]
  C --> D[CovidAnalyticsService.completeAndFillDailySeries]
  D --> E[Filled Daily Series]
  E --> F[TimeSeriesAggregator.aggregate]
  F --> G[CovidMetricsBucket[]]
  G --> H[Charts: MetricsChart]
  G --> I[Map: CovidWorldMap]
  G --> J[Table: MetricsTable]
```

