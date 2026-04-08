import { describe, expect, it } from "vitest";
import { CovidAnalyticsService } from "@/lib/services/CovidAnalyticsService";
import { CountryMetadataResolver } from "@/lib/services/CountryMetadataResolver";

function anyService() {
  return new CovidAnalyticsService(new CountryMetadataResolver()) as any;
}

describe("CovidAnalyticsService completeAndFillDailySeries", () => {
  it("creates a continuous daily series and carries forward totals for missing dates", () => {
    const svc = anyService();
    const days = [
      {
        date: "2020-01-01",
        newCases: 1,
        totalCases: 1,
        newDeaths: 0,
        totalDeaths: 0,
        newRecovered: 0,
        totalRecovered: 0,
        newVaccinations: null,
        peopleVaccinated: null,
        peopleFullyVaccinated: null,
        population: 100,
      },
      {
        // 2020-01-02 missing
        date: "2020-01-03",
        newCases: null,
        totalCases: 3,
        newDeaths: null,
        totalDeaths: 1,
        newRecovered: null,
        totalRecovered: 2,
        newVaccinations: null,
        peopleVaccinated: null,
        peopleFullyVaccinated: null,
        population: 100,
      },
    ];

    const out = svc.completeAndFillDailySeries(days, "2020-01-01", "2020-01-03", {
      mirrorLatestToToday: true,
    });

    expect(out.map((d: any) => d.date)).toEqual([
      "2020-01-01",
      "2020-01-02",
      "2020-01-03",
    ]);

    // Missing day: totals carried forward, new = 0
    expect(out[1].totalCases).toBe(1);
    expect(out[1].totalDeaths).toBe(0);
    expect(out[1].totalRecovered).toBe(0);
    expect(out[1].newCases).toBe(0);
    expect(out[1].newDeaths).toBe(0);
    expect(out[1].newRecovered).toBe(0);

    // Existing day with null new_*: computed from total deltas vs previous totals
    expect(out[2].newCases).toBe(2);
    expect(out[2].newDeaths).toBe(1);
    expect(out[2].newRecovered).toBe(2);
  });

  it("does not backfill cumulative totals into the past (but keeps population populated)", () => {
    const svc = anyService();
    const days = [
      {
        date: "2020-01-02",
        newCases: 0,
        totalCases: 10,
        newDeaths: 0,
        totalDeaths: 1,
        newRecovered: 0,
        totalRecovered: 2,
        newVaccinations: null,
        peopleVaccinated: null,
        peopleFullyVaccinated: null,
        population: 100,
      },
    ];

    const out = svc.completeAndFillDailySeries(days, "2020-01-01", "2020-01-02", {
      mirrorLatestToToday: true,
    });

    expect(out[0].date).toBe("2020-01-01");
    expect(out[0].population).toBe(100);
    // No future totals should appear on earlier synthetic days.
    expect(out[0].totalCases).toBe(0);
    expect(out[0].totalDeaths).toBe(0);
    expect(out[0].totalRecovered).toBe(0);
    expect(out[0].newCases).toBe(0);
    expect(out[0].newDeaths).toBe(0);
    expect(out[0].newRecovered).toBe(0);
  });

  it("does not allow recovered cumulative to reset to zero after reporting stops", () => {
    const svc = anyService();
    const days = [
      {
        date: "2020-01-01",
        newCases: 10,
        totalCases: 10,
        newDeaths: 0,
        totalDeaths: 0,
        newRecovered: 5,
        totalRecovered: 5,
        newVaccinations: 0,
        peopleVaccinated: 0,
        peopleFullyVaccinated: 0,
        population: 100,
      },
      {
        // Source emits an erroneous reset
        date: "2020-01-02",
        newCases: 0,
        totalCases: 10,
        newDeaths: 0,
        totalDeaths: 0,
        newRecovered: 0,
        totalRecovered: 0,
        newVaccinations: 0,
        peopleVaccinated: 0,
        peopleFullyVaccinated: 0,
        population: 100,
      },
    ];

    const out = svc.completeAndFillDailySeries(days, "2020-01-01", "2020-01-02", {
      mirrorLatestToToday: true,
    });

    expect(out[1].totalRecovered).toBe(5);
  });
});

describe("CovidAnalyticsService recovered seeding", () => {
  it("does not seed recovered at the start of range using future values", () => {
    const svc = new CovidAnalyticsService(new CountryMetadataResolver());

    // Minimal OWID-like block: recovered becomes available only later.
    const raw = {
      AFG: {
        location: "Testland",
        iso_code: "TST",
        continent: "Asia",
        data: [
          { date: "2020-03-01", total_cases: 1, total_deaths: 0, total_recovered: 0, population: 100 },
          // recovered starts being reported much later
          { date: "2021-03-01", total_cases: 10, total_deaths: 1, total_recovered: 9, population: 100 },
        ],
      },
    };

    const out = svc.buildFromOwidDocument(
      raw,
      {
        isoAlpha3Filter: ["TST"],
        dateFrom: "2020-03-01",
        dateTo: "2020-03-10",
        granularity: "daily",
        mirrorLatestToToday: true,
      },
      "2026-01-01T00:00:00Z",
    );

    expect(out.countries.length).toBe(1);
    const buckets = out.countries[0].buckets;
    // In this range, recovered should not be prefilled with the 2021 value.
    expect(buckets[0].totalRecoveredEnd).toBe(0);
  });
});

