import type {
  CountrySeriesPayload,
  CovidApiMeta,
  CovidApiResponse,
  TimeGranularity,
} from "@/lib/types/covid";
import { CountryMetadataResolver } from "@/lib/services/CountryMetadataResolver";
import { OwidCovidParser } from "@/lib/services/OwidCovidParser";
import { TimeSeriesAggregator } from "@/lib/services/TimeSeriesAggregator";
import { addDays, parseISO } from "date-fns";

export interface BuildCovidDashboardInput {
  /** ISO 3166-1 alpha-3 codes, uppercase; empty = all countries */
  isoAlpha3Filter: string[];
  dateFrom: string;
  dateTo: string;
  granularity: TimeGranularity;
  /**
   * When true and the upstream source has not yet published up to `dateTo`,
   * the service forward-fills cumulative values to `dateTo` (new_* = 0).
   */
  mirrorLatestToToday?: boolean;
}

/**
 * Transforms a pre-fetched OWID document into dashboard payloads.
 * Data provenance: Our World in Data (curated from WHO, national reports, etc.—see OWID notes).
 */
export class CovidAnalyticsService {
  constructor(private readonly metadataResolver: CountryMetadataResolver) {}

  buildFromOwidDocument(
    raw: unknown,
    input: BuildCovidDashboardInput,
    fetchedAt: string,
  ): CovidApiResponse {
    const blocks = OwidCovidParser.parseBlocks(raw);
    const filterSet =
      input.isoAlpha3Filter.length > 0
        ? new Set(input.isoAlpha3Filter.map((c) => c.toUpperCase()))
        : null;

    const countries: CountrySeriesPayload[] = [];
    const aggregator = new TimeSeriesAggregator({
      granularity: input.granularity,
    });
    let supportsVaccination = false;

    for (const block of blocks) {
      const iso = (block.iso_code ?? "").toUpperCase();
      if (!iso || iso.startsWith("OWID")) continue;
      if (!/^[A-Z]{3}$/.test(iso)) continue;
      if (filterSet && !filterSet.has(iso)) continue;

      const mirror = input.mirrorLatestToToday ?? true;
      // Pull all observations up to the requested end date.
      // Important: if the requested range starts after the latest available observation,
      // we still want to return a country series when mirroring is enabled.
      const allUpToTo = (block.data ?? [])
        .filter((row) => row.date <= input.dateTo)
        .map((row) => OwidCovidParser.normalizeDay(row))
        .sort((a, b) => a.date.localeCompare(b.date));

      if (allUpToTo.length === 0) continue;

      const baseline = [...allUpToTo]
        .reverse()
        .find((d) => d.date < input.dateFrom) ?? null;
      // IMPORTANT: Never seed the start of the range with a value from *after* `dateFrom`.
      // Doing so makes early timeline points look like they already have "future" recovered totals,
      // which produces flat high lines and nonsensical charts.
      const lastPositiveRecoveredBeforeFrom =
        [...allUpToTo]
          .reverse()
          .find(
            (d) => d.date < input.dateFrom && (d.totalRecovered ?? 0) > 0,
          )?.totalRecovered ?? null;
      const inRangeRaw = allUpToTo.filter(
        (d) => d.date >= input.dateFrom && d.date <= input.dateTo,
      );
      const inRange = [...inRangeRaw];

      // Seed the start of the range with the last-known cumulative values so forward-fill works
      // even when the source has gaps (or the requested `from` is after data-through).
      if (
        mirror &&
        lastPositiveRecoveredBeforeFrom != null &&
        lastPositiveRecoveredBeforeFrom > 0 &&
        inRange.length > 0 &&
        inRange[0]?.date === input.dateFrom &&
        (inRange[0].totalRecovered ?? 0) === 0
      ) {
        // Override a reset-to-0 at the start of the requested range.
        inRange[0] = {
          ...inRange[0],
          totalRecovered: lastPositiveRecoveredBeforeFrom,
          newRecovered: 0,
        };
      }

      const seedAtFrom =
        mirror && baseline
          ? {
              date: input.dateFrom,
              newCases: 0,
              totalCases: baseline.totalCases,
              newDeaths: 0,
              totalDeaths: baseline.totalDeaths,
              newRecovered: 0,
              totalRecovered:
                // Only use values from the historical side of the range.
                // If baseline looks like a reset-to-0 but we had a prior positive value, keep continuity.
                (baseline.totalRecovered ?? 0) > 0
                  ? baseline.totalRecovered
                  : lastPositiveRecoveredBeforeFrom != null &&
                      lastPositiveRecoveredBeforeFrom > 0 &&
                      (baseline.totalRecovered ?? 0) === 0
                    ? lastPositiveRecoveredBeforeFrom
                    : baseline.totalRecovered,
              newVaccinations: 0,
              peopleVaccinated: baseline.peopleVaccinated,
              peopleFullyVaccinated: baseline.peopleFullyVaccinated,
              population: baseline.population,
            }
          : null;

      const daysForFill =
        inRange.length > 0
          ? [
              ...(seedAtFrom && inRange[0]?.date !== input.dateFrom
                ? [seedAtFrom]
                : []),
              ...inRange,
            ]
          : mirror
            ? [seedAtFrom ?? allUpToTo[allUpToTo.length - 1]].filter(Boolean)
            : [];

      if (daysForFill.length === 0) continue;

      // Ensure every country has a complete daily timeline across the requested range,
      // then fill any missing values using the latest available observations.
      const filledDays = this.completeAndFillDailySeries(
        daysForFill,
        input.dateFrom,
        input.dateTo,
        { mirrorLatestToToday: mirror },
      );

      const lastWithPop = [...filledDays]
        .reverse()
        .find((d) => d.population != null);
      const profile = this.metadataResolver.resolveFromOwidRow(
        block.location,
        iso,
        block.continent ?? null,
        lastWithPop?.population ?? null,
        { lat: block.lat ?? null, lng: block.lng ?? null },
      );

      countries.push({
        profile,
        buckets: aggregator.aggregate(filledDays),
      });

      if (!supportsVaccination) {
        // This is much cheaper than a full scan on the client.
        const lastBucket =
          countries[countries.length - 1]?.buckets[
            countries[countries.length - 1].buckets.length - 1
          ];
        if (lastBucket?.vaccinationRatePercent != null) {
          supportsVaccination = true;
        }
      }
    }

    countries.sort((a, b) =>
      a.profile.countryName.localeCompare(b.profile.countryName),
    );

    const meta: CovidApiMeta = {
      sourceName: "Our World in Data — COVID-19 dataset",
      sourceUrl:
        "https://covid.ourworldindata.org/data/owid-covid-data.json",
      attribution:
        "Our World in Data aggregates metrics from official institutional reporting chains (including WHO situational reports where cited as the upstream national source). Refer to OWID for country-level attribution notes.",
      fetchedAt,
      supportsVaccination,
      dataThroughDate: "unknown",
      requestedFrom: "unknown",
      requestedTo: "unknown",
      effectiveFrom: "unknown",
      effectiveTo: "unknown",
      notes: [
        "Infection and death rates use new cases/deaths in the bucket divided by population (last reported day in that bucket), ×100,000.",
        "Vaccination rate is cumulative people with at least one dose divided by population at period end, where both values exist.",
        "Very recent days may be subject to reporting delays in the upstream sources OWID reflects.",
      ],
    };

    return { meta, countries };
  }

  private completeAndFillDailySeries(
    days: ReturnType<typeof OwidCovidParser.normalizeDay>[],
    isoDateFrom: string,
    isoDateTo: string,
    opts: { mirrorLatestToToday: boolean },
  ): ReturnType<typeof OwidCovidParser.normalizeDay>[] {
    const byDate = new Map<string, ReturnType<typeof OwidCovidParser.normalizeDay>>();
    for (const d of days) byDate.set(d.date, d);

    // Build a continuous daily timeline for the requested range.
    // IMPORTANT: Treat ISO date-only strings as UTC-midnight to avoid timezone shifts
    // (e.g., parsing "2020-01-01" in a negative offset timezone can become "2019-12-31").
    const start = parseISO(`${isoDateFrom}T00:00:00Z`);
    const end = parseISO(`${isoDateTo}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return [...days].sort((a, b) => a.date.localeCompare(b.date));
    }

    const series: ReturnType<typeof OwidCovidParser.normalizeDay>[] = [];
    for (
      let cur = start;
      cur.getTime() <= end.getTime();
      cur = addDays(cur, 1)
    ) {
      const date = cur.toISOString().slice(0, 10);
      const existing = byDate.get(date);
      if (existing) series.push(existing);
      else {
        series.push({
          date,
          newCases: null,
          totalCases: null,
          newDeaths: null,
          totalDeaths: null,
          newRecovered: null,
          totalRecovered: null,
          newVaccinations: null,
          peopleVaccinated: null,
          peopleFullyVaccinated: null,
          population: null,
        });
      }
    }

    // Pre-sanitize clearly invalid recovered values (some sources emit -1).
    for (const cur of series) {
      if (cur.totalRecovered != null && cur.totalRecovered < 0) {
        cur.totalRecovered = null;
      }
      if (cur.newRecovered != null && cur.newRecovered < 0) {
        cur.newRecovered = 0;
      }
    }

    // 1) Forward-fill cumulative-ish fields (latest data as backfill for missing values).
    for (let i = 0; i < series.length; i++) {
      const prev = i > 0 ? series[i - 1] : null;
      const cur = series[i];
      if (!prev) continue;

      // If totals are missing but daily increments exist, reconstruct totals as previous + new.
      // Otherwise, carry forward the latest known totals.
      if (cur.totalCases == null && prev.totalCases != null) {
        const inc = cur.newCases ?? 0;
        cur.totalCases = prev.totalCases + inc;
      } else {
        cur.totalCases ??= prev.totalCases;
      }
      if (cur.totalDeaths == null && prev.totalDeaths != null) {
        const inc = cur.newDeaths ?? 0;
        cur.totalDeaths = prev.totalDeaths + inc;
      } else {
        cur.totalDeaths ??= prev.totalDeaths;
      }
      if (cur.totalRecovered == null && prev.totalRecovered != null) {
        const inc = cur.newRecovered ?? 0;
        cur.totalRecovered = prev.totalRecovered + inc;
      } else {
        cur.totalRecovered ??= prev.totalRecovered;
      }
      // If recovered total is spuriously 0 but there was a previous positive cumulative,
      // treat it as missing and reconstruct/carry forward.
      if ((prev.totalRecovered ?? 0) > 0 && cur.totalRecovered === 0) {
        const inc = cur.newRecovered ?? 0;
        cur.totalRecovered = inc > 0 ? prev.totalRecovered! + inc : prev.totalRecovered;
      }
      // Some sources stop reporting recovered and emit zeros; treat an apparent reset-to-0
      // as missing when we previously had a positive cumulative value.
      if (
        cur.totalRecovered === 0 &&
        (prev.totalRecovered ?? 0) > 0 &&
        (cur.newRecovered == null || cur.newRecovered === 0)
      ) {
        cur.totalRecovered = prev.totalRecovered;
      }

      // If a source stops reporting recovered, it may also drop the daily recovered to 0.
      // Keep newRecovered consistent with the forward-fill (no new events).
      if (
        cur.newRecovered === 0 &&
        (prev.totalRecovered ?? 0) > 0 &&
        cur.totalRecovered === prev.totalRecovered
      ) {
        cur.newRecovered = 0;
      }

      cur.peopleVaccinated ??= prev.peopleVaccinated;
      cur.peopleFullyVaccinated ??= prev.peopleFullyVaccinated;
      cur.population ??= prev.population;

      // 1b) Enforce monotonicity for cumulative totals.
      // Some upstream sources emit smaller non-zero cumulative totals after reporting methodology changes.
      // For charting/aggregation and rate calculations, treat any drop as a missing value and carry forward.
      if (prev.totalCases != null && cur.totalCases != null && cur.totalCases < prev.totalCases) {
        cur.totalCases = prev.totalCases;
      }
      if (prev.totalDeaths != null && cur.totalDeaths != null && cur.totalDeaths < prev.totalDeaths) {
        cur.totalDeaths = prev.totalDeaths;
      }
      if (
        prev.totalRecovered != null &&
        cur.totalRecovered != null &&
        cur.totalRecovered < prev.totalRecovered
      ) {
        cur.totalRecovered = prev.totalRecovered;
      }
      if (
        prev.peopleVaccinated != null &&
        cur.peopleVaccinated != null &&
        cur.peopleVaccinated < prev.peopleVaccinated
      ) {
        cur.peopleVaccinated = prev.peopleVaccinated;
      }
      if (
        prev.peopleFullyVaccinated != null &&
        cur.peopleFullyVaccinated != null &&
        cur.peopleFullyVaccinated < prev.peopleFullyVaccinated
      ) {
        cur.peopleFullyVaccinated = prev.peopleFullyVaccinated;
      }
    }

    // 2) Backward-fill only stable metadata at the start of the series.
    // IMPORTANT: do NOT backfill cumulative totals into the past, because that makes
    // early-period ratios (e.g., recovery rate) mathematically impossible.
    for (let i = series.length - 2; i >= 0; i--) {
      const next = series[i + 1];
      const cur = series[i];

      cur.population ??= next.population;
    }

    // 3) Ensure `new_*` exists for every day:
    // - If missing but totals are available, compute delta from previous totals.
    // - If the day itself was missing in source, treat it as no new events (0) and carry totals.
    for (let i = 0; i < series.length; i++) {
      const prev = i > 0 ? series[i - 1] : null;
      const cur = series[i];
      const wasSynthetic = !byDate.has(cur.date);

      if (cur.newCases == null) {
        if (wasSynthetic) cur.newCases = 0;
        else if (cur.totalCases != null && prev?.totalCases != null) {
          cur.newCases = Math.max(0, cur.totalCases - prev.totalCases);
        } else {
          cur.newCases = 0;
        }
      }
      if (cur.newDeaths == null) {
        if (wasSynthetic) cur.newDeaths = 0;
        else if (cur.totalDeaths != null && prev?.totalDeaths != null) {
          cur.newDeaths = Math.max(0, cur.totalDeaths - prev.totalDeaths);
        } else {
          cur.newDeaths = 0;
        }
      }
      if (cur.newRecovered == null) {
        if (wasSynthetic) cur.newRecovered = 0;
        else if (cur.totalRecovered != null && prev?.totalRecovered != null) {
          cur.newRecovered = Math.max(0, cur.totalRecovered - prev.totalRecovered);
        } else {
          cur.newRecovered = 0;
        }
      }
      if (cur.newVaccinations == null) {
        if (wasSynthetic) cur.newVaccinations = 0;
        else {
          // OWID vaccination data can be sparse; default missing daily increments to 0.
          cur.newVaccinations = 0;
        }
      }
    }

    // 4) Hard-default any remaining nulls to 0 so all buckets have numeric values.
    for (const d of series) {
      d.totalCases ??= 0;
      d.totalDeaths ??= 0;
      d.totalRecovered ??= 0;
      d.peopleVaccinated ??= 0;
      d.peopleFullyVaccinated ??= 0;
      d.population ??= 0;
    }

    // If mirroring is disabled, do not extend beyond the upstream series end; the caller already clamps.
    // When mirroring is enabled, this function already includes all dates up to isoDateTo.
    // (No-op here; retained to keep behavior explicit.)
    void opts;

    return series;
  }
}

export function createCovidAnalyticsService(): CovidAnalyticsService {
  return new CovidAnalyticsService(new CountryMetadataResolver());
}
