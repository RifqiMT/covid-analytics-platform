/**
 * Domain types for COVID analytics. Naming follows epidemiology conventions.
 */

export type TimeGranularity =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "annually";

/** Single raw day from Our World in Data normalized row */
export interface DailyCovidObservation {
  date: string;
  newCases: number | null;
  totalCases: number | null;
  newDeaths: number | null;
  totalDeaths: number | null;
  newRecovered: number | null;
  totalRecovered: number | null;
  newVaccinations: number | null;
  peopleVaccinated: number | null;
  peopleFullyVaccinated: number | null;
  population: number | null;
}

/** Country metadata joined from OWID + reference datasets */
export interface CountryProfile {
  countryName: string;
  isoAlpha3: string;
  isoAlpha2: string | null;
  continent: string | null;
  population: number | null;
  flagUrl: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Aggregated bucket for charts/tables/maps */
export interface CovidMetricsBucket {
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  granularity: TimeGranularity;
  newCasesSum: number;
  newDeathsSum: number;
  newRecoveredSum: number;
  newVaccinationsSum: number;
  /** Latest cumulative totals observed inside the bucket */
  totalCasesEnd: number | null;
  totalDeathsEnd: number | null;
  totalRecoveredEnd: number | null;
  /** Latest cumulative people vaccinated inside the bucket */
  peopleVaccinatedEnd: number | null;
  populationEnd: number | null;
  /** New cases per 100k population (uses populationEnd when available) */
  infectionRatePer100k: number | null;
  /** Cumulative cases divided by population at period end (share, %). */
  infectionRatePercent: number | null;
  /** New deaths per 100k */
  deathRatePer100k: number | null;
  /** New recoveries per 100k */
  recoveryRatePer100k: number | null;
  /** Cumulative recoveries divided by cumulative cases at period end (%). */
  recoveryRatePercent: number | null;
  /** Cumulative deaths divided by cumulative cases at period end (%). */
  mortalityRatePercent: number | null;
  /** Share of population with at least one dose at period end */
  vaccinationRatePercent: number | null;
}

export interface CountrySeriesPayload {
  profile: CountryProfile;
  buckets: CovidMetricsBucket[];
}

export interface CovidApiMeta {
  sourceName: string;
  sourceUrl: string;
  attribution: string;
  fetchedAt: string;
  /** Whether vaccination metrics are present for at least one bucket/country. */
  supportsVaccination?: boolean;
  /** Latest date present in the upstream dataset (not necessarily today). */
  dataThroughDate: string;
  /** What the client requested vs what the API actually used (after clamping). */
  requestedFrom: string;
  requestedTo: string;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string[];
}

export interface CovidApiResponse {
  meta: CovidApiMeta;
  countries: CountrySeriesPayload[];
}
