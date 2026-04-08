import type { DailyCovidObservation } from "@/lib/types/covid";

/** Raw Our World in Data row (subset) */
export interface OwidRawDay {
  date: string;
  new_cases?: number | null;
  total_cases?: number | null;
  new_deaths?: number | null;
  total_deaths?: number | null;
  new_recovered?: number | null;
  total_recovered?: number | null;
  new_vaccinations?: number | null;
  people_vaccinated?: number | null;
  people_fully_vaccinated?: number | null;
  population?: number | null;
}

export interface OwidRawBlock {
  continent?: string;
  location: string;
  iso_code?: string;
  data?: OwidRawDay[];
  /** Optional geo overrides for map rendering (when provided by source). */
  lat?: number | null;
  lng?: number | null;
}

/**
 * Parses OWID JSON whether top-level is a Record or an array of blocks.
 */
export class OwidCovidParser {
  static parseBlocks(raw: unknown): OwidRawBlock[] {
    if (Array.isArray(raw)) {
      return raw.filter(
        (r): r is OwidRawBlock =>
          !!r && typeof r === "object" && "location" in r,
      ) as OwidRawBlock[];
    }
    if (raw && typeof raw === "object") {
      return Object.values(raw).filter(
        (r): r is OwidRawBlock =>
          !!r && typeof r === "object" && "location" in r,
      ) as OwidRawBlock[];
    }
    return [];
  }

  static normalizeDay(row: OwidRawDay): DailyCovidObservation {
    return {
      date: row.date,
      newCases: OwidCovidParser.num(row.new_cases),
      totalCases: OwidCovidParser.num(row.total_cases),
      newDeaths: OwidCovidParser.num(row.new_deaths),
      totalDeaths: OwidCovidParser.num(row.total_deaths),
      newRecovered: OwidCovidParser.num(row.new_recovered),
      totalRecovered: OwidCovidParser.num(row.total_recovered),
      newVaccinations: OwidCovidParser.num(row.new_vaccinations),
      peopleVaccinated: OwidCovidParser.num(row.people_vaccinated),
      peopleFullyVaccinated: OwidCovidParser.num(row.people_fully_vaccinated),
      population: OwidCovidParser.num(row.population),
    };
  }

  private static num(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  }
}
