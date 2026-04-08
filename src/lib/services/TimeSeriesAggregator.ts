import {
  endOfISOWeek,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  getQuarter,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfISOWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "date-fns";
import type {
  CovidMetricsBucket,
  DailyCovidObservation,
  TimeGranularity,
} from "@/lib/types/covid";

export interface TimeSeriesAggregatorOptions {
  granularity: TimeGranularity;
}

/**
 * Groups daily observations into reporting buckets and derives rate metrics.
 */
export class TimeSeriesAggregator {
  constructor(private readonly options: TimeSeriesAggregatorOptions) {}

  // Guardrail: rate metrics become extremely noisy / misleading with tiny denominators
  // (e.g., early outbreak days can show 100% mortality with 1 case & 1 death).
  private static readonly MIN_CUMULATIVE_FOR_RATES = 100;

  private clampPercent(v: number): number {
    if (!Number.isFinite(v)) return 0;
    if (v < 0) return 0;
    if (v > 100) return 100;
    return v;
  }

  private ratioPercentOrNull(
    numerator: number | null | undefined,
    denominator: number | null | undefined,
  ): number | null {
    if (numerator == null || denominator == null) return null;
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
    if (denominator < TimeSeriesAggregator.MIN_CUMULATIVE_FOR_RATES) return null;
    if (denominator <= 0) return null;
    // Cumulative sub-metrics cannot logically exceed the cumulative total they’re derived from.
    if (numerator < 0) return null;
    if (numerator > denominator) return null;
    return this.clampPercent((numerator / denominator) * 100);
  }

  aggregate(days: DailyCovidObservation[]): CovidMetricsBucket[] {
    if (days.length === 0) return [];
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const groups = new Map<string, DailyCovidObservation[]>();
    for (const d of sorted) {
      const key = this.bucketKey(d.date);
      const list = groups.get(key) ?? [];
      list.push(d);
      groups.set(key, list);
    }

    const buckets: CovidMetricsBucket[] = [];
    for (const [key, groupDays] of groups) {
      buckets.push(this.toBucket(key, groupDays));
    }
    return buckets.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  }

  private bucketKey(isoDate: string): string {
    const d = parseISO(isoDate);
    switch (this.options.granularity) {
      case "daily":
        return isoDate;
      case "weekly": {
        const start = startOfISOWeek(d);
        return format(start, "yyyy-MM-dd");
      }
      case "monthly":
        return format(startOfMonth(d), "yyyy-MM");
      case "quarterly":
        return `${d.getFullYear()}-Q${getQuarter(d)}`;
      case "annually":
        return format(startOfYear(d), "yyyy");
      default:
        return isoDate;
    }
  }

  private toBucket(
    key: string,
    groupDays: DailyCovidObservation[],
  ): CovidMetricsBucket {
    const granularity = this.options.granularity;
    const first = groupDays[0];
    const last = groupDays[groupDays.length - 1];
    const startDate = parseISO(first.date);
    let periodStart = first.date;
    let periodEnd = last.date;
    let periodLabel = key;

    if (granularity === "weekly") {
      const wStart = startOfISOWeek(parseISO(first.date));
      const wEnd = endOfISOWeek(wStart);
      periodStart = format(wStart, "yyyy-MM-dd");
      periodEnd = format(wEnd, "yyyy-MM-dd");
      periodLabel = `W${getISOWeek(wStart)} ${getISOWeekYear(wStart)}`;
    } else if (granularity === "monthly") {
      const mStart = startOfMonth(startDate);
      const mEnd = endOfMonth(startDate);
      periodStart = format(mStart, "yyyy-MM-dd");
      periodEnd = format(mEnd, "yyyy-MM-dd");
      periodLabel = format(mStart, "MMM yyyy");
    } else if (granularity === "quarterly") {
      const qStart = startOfQuarter(startDate);
      const qEnd = endOfQuarter(startDate);
      periodStart = format(qStart, "yyyy-MM-dd");
      periodEnd = format(qEnd, "yyyy-MM-dd");
      periodLabel = `Q${getQuarter(startDate)} ${startDate.getFullYear()}`;
    } else if (granularity === "annually") {
      const yStart = startOfYear(startDate);
      const yEnd = endOfYear(startDate);
      periodStart = format(yStart, "yyyy-MM-dd");
      periodEnd = format(yEnd, "yyyy-MM-dd");
      periodLabel = format(yStart, "yyyy");
    }

    let newCasesSum = 0;
    let newDeathsSum = 0;
    let newRecoveredSum = 0;
    let newVaccinationsSum = 0;
    for (const row of groupDays) {
      newCasesSum += row.newCases ?? 0;
      newDeathsSum += row.newDeaths ?? 0;
      newRecoveredSum += row.newRecovered ?? 0;
      newVaccinationsSum += row.newVaccinations ?? 0;
    }

    const populationEnd = last.population;
    const infectionRatePer100k =
      populationEnd && populationEnd > 0
        ? (newCasesSum / populationEnd) * 100_000
        : null;
    const totalCasesEnd = last.totalCases;
    const totalDeathsEnd = last.totalDeaths;
    const totalRecoveredEnd = last.totalRecovered;
    const infectionRatePercent =
      populationEnd && populationEnd > 0 && totalCasesEnd != null
        ? (totalCasesEnd / populationEnd) * 100
        : null;
    const deathRatePer100k =
      populationEnd && populationEnd > 0
        ? (newDeathsSum / populationEnd) * 100_000
        : null;
    const recoveryRatePer100k =
      populationEnd && populationEnd > 0
        ? (newRecoveredSum / populationEnd) * 100_000
        : null;
    const recoveryRatePercent =
      this.ratioPercentOrNull(totalRecoveredEnd, totalCasesEnd);
    const mortalityRatePercent = this.ratioPercentOrNull(totalDeathsEnd, totalCasesEnd);
    const vacc = last.peopleVaccinated;
    const vaccinationRatePercent =
      populationEnd && populationEnd > 0 && vacc != null
        ? (vacc / populationEnd) * 100
        : null;

    return {
      periodStart,
      periodEnd,
      periodLabel,
      granularity,
      newCasesSum,
      newDeathsSum,
      newRecoveredSum,
      newVaccinationsSum,
      totalCasesEnd: totalCasesEnd,
      totalDeathsEnd: totalDeathsEnd,
      totalRecoveredEnd: totalRecoveredEnd,
      peopleVaccinatedEnd: last.peopleVaccinated,
      populationEnd,
      infectionRatePer100k,
      infectionRatePercent,
      deathRatePer100k,
      recoveryRatePer100k,
      recoveryRatePercent,
      mortalityRatePercent,
      vaccinationRatePercent,
    };
  }
}
