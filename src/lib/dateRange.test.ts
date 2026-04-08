import { describe, expect, it, vi } from "vitest";
import { normalizeDateRange, utcTodayIso } from "@/lib/dateRange";

describe("normalizeDateRange", () => {
  it("clamps end date to today when in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:00.000Z"));
    expect(utcTodayIso()).toBe("2026-04-07");
    const { dateFrom, dateTo, rangeNotes } = normalizeDateRange(
      "2020-01-01",
      "2030-01-01",
    );
    expect(dateTo).toBe("2026-04-07");
    expect(dateFrom).toBe("2020-01-01");
    expect(rangeNotes.some((n) => n.includes("after today"))).toBe(true);
    vi.useRealTimers();
  });

  it("moves start to end when start is after end", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01T12:00:00.000Z"));
    const { dateFrom, dateTo, rangeNotes } = normalizeDateRange(
      "2024-12-01",
      "2024-01-15",
    );
    expect(dateFrom).toBe("2024-01-15");
    expect(dateTo).toBe("2024-01-15");
    expect(rangeNotes.some((n) => n.includes("Start date was after end"))).toBe(
      true,
    );
    vi.useRealTimers();
  });
});
