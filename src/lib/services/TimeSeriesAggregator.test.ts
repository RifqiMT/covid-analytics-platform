import { describe, expect, it } from "vitest";
import { TimeSeriesAggregator } from "@/lib/services/TimeSeriesAggregator";
import type { DailyCovidObservation } from "@/lib/types/covid";

function day(
  date: string,
  nc: number,
  nd: number,
  pop: number,
): DailyCovidObservation {
  return {
    date,
    newCases: nc,
    totalCases: null,
    newDeaths: nd,
    totalDeaths: null,
    newRecovered: 0,
    totalRecovered: null,
    newVaccinations: 0,
    peopleVaccinated: null,
    peopleFullyVaccinated: null,
    population: pop,
  };
}

describe("TimeSeriesAggregator", () => {
  it("aggregates monthly sums and rates", () => {
    const agg = new TimeSeriesAggregator({ granularity: "monthly" });
    const rows: DailyCovidObservation[] = [
      {
        ...day("2020-01-01", 100, 10, 1_000_000),
        totalCases: 100,
        totalDeaths: 1,
        totalRecovered: 20,
      },
      {
        ...day("2020-01-15", 50, 0, 1_000_000),
        totalCases: 150,
        totalDeaths: 10,
        totalRecovered: 40,
      },
      {
        ...day("2020-02-02", 200, 20, 1_000_000),
        totalCases: 350,
        totalDeaths: 30,
        totalRecovered: 100,
      },
    ];
    const buckets = agg.aggregate(rows);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].newCasesSum).toBe(150);
    expect(buckets[0].newDeathsSum).toBe(10);
    expect(buckets[0].infectionRatePer100k).toBeCloseTo(15, 5);
    expect(buckets[0].infectionRatePercent).toBeCloseTo(0.015, 6);
    expect(buckets[0].recoveryRatePercent).toBeCloseTo((40 / 150) * 100, 6);
    expect(buckets[0].mortalityRatePercent).toBeCloseTo((10 / 150) * 100, 6);
    expect(buckets[1].newCasesSum).toBe(200);
  });

  it("returns empty array for no input", () => {
    const agg = new TimeSeriesAggregator({ granularity: "daily" });
    expect(agg.aggregate([])).toEqual([]);
  });
});
