/**
 * Resilient download of the large OWID JSON document.
 * Node's fetch often surfaces network issues as TypeError("fetch failed") with a cause chain.
 */

import { Readable } from "node:stream";
import { parse } from "csv-parse";
import type { OwidRawBlock, OwidRawDay } from "@/lib/services/OwidCovidParser";

const DEFAULT_ATTEMPTS = 3;
const TIMEOUT_MS = 120_000;

export const RIFQI_REPO_BASE =
  "https://raw.githubusercontent.com/RifqiMT/COVID-19/master";

export const RIFQI_CONFIRMED_GLOBAL_CSV = `${RIFQI_REPO_BASE}/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv`;
export const RIFQI_DEATHS_GLOBAL_CSV = `${RIFQI_REPO_BASE}/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv`;
export const RIFQI_RECOVERED_GLOBAL_CSV = `${RIFQI_REPO_BASE}/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_recovered_global.csv`;
export const RIFQI_UID_LOOKUP_CSV = `${RIFQI_REPO_BASE}/csse_covid_19_data/UID_ISO_FIPS_LookUp_Table.csv`;

export const OWID_JSON_URL =
  "https://covid.ourworldindata.org/data/owid-covid-data.json";

export const OWID_COMPACT_CSV_URL =
  "https://catalog.ourworldindata.org/garden/covid/latest/compact/compact.csv";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractCauseChain(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  let depth = 0;
  while (cur && depth < 5) {
    if (cur instanceof Error) {
      if (cur.message && !parts.includes(cur.message)) {
        parts.push(cur.message);
      }
      cur = cur.cause;
    } else if (typeof cur === "object" && cur && "code" in cur) {
      parts.push(String((cur as { code?: string }).code ?? cur));
      break;
    } else {
      parts.push(String(cur));
      break;
    }
    depth++;
  }
  return parts.filter(Boolean).join(" → ");
}

export function formatOwidFetchError(err: unknown): Error {
  if (err instanceof Error) {
    const causeText = extractCauseChain(err);
    if (
      err.message === "fetch failed" ||
      err.name === "AbortError" ||
      err.message.includes("aborted")
    ) {
      return new Error(
        [
          "Could not download COVID data from Our World in Data.",
          err.name === "AbortError"
            ? `The request timed out after ${TIMEOUT_MS / 1000}s.`
            : causeText
              ? `Network: ${causeText}`
              : "Network error (no extra details).",
          "Try: check internet / VPN / firewall. The dataset is a large file (~50MB+).",
        ].join(" "),
      );
    }
    if (causeText && causeText !== err.message) {
      return new Error(`${err.message} (${causeText})`);
    }
    return err;
  }
  return new Error(String(err));
}

/**
 * Fetches URL with retries and a single long timeout per attempt.
 */
async function fetchJsonWithRetries(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DEFAULT_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(
          `Our World in Data returned HTTP ${res.status} ${res.statusText}`,
        );
      }
      return await res.json();
    } catch (e) {
      lastError = e;
      if (attempt < DEFAULT_ATTEMPTS) {
        await delay(1500 * attempt);
      }
    }
  }
  throw formatOwidFetchError(lastError);
}

async function fetchCompactCsvAsBlocks(url: string): Promise<OwidRawBlock[]> {
  const res = await fetch(url, {
    headers: { Accept: "text/csv" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // Keep this uncached at the fetch layer; caching happens in owidCachedFetch.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `OWID catalog returned HTTP ${res.status} ${res.statusText}`,
    );
  }
  if (!res.body) {
    throw new Error("OWID catalog response had no body");
  }

  const blocks = new Map<string, OwidRawBlock>();

  // `csv-parse` works with Node streams; convert the web stream.
  // Next.js types `res.body` as a DOM ReadableStream; Node expects `stream/web` ReadableStream.
  // At runtime this works in the Node.js server environment.
  const nodeStream = Readable.fromWeb(res.body as any);
  const parser = nodeStream.pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
    }),
  );

  for await (const row of parser) {
    // Expected columns based on OWID docs: country,date,...,code,continent,population
    const iso = String(row.code ?? "").toUpperCase();
    if (!iso || iso.startsWith("OWID") || !/^[A-Z]{3}$/.test(iso)) continue;

    const location = String(row.country ?? "");
    const continent = row.continent ? String(row.continent) : undefined;

    const day: OwidRawDay = {
      date: String(row.date),
      new_cases: num(row.new_cases),
      total_cases: num(row.total_cases),
      new_deaths: num(row.new_deaths),
      total_deaths: num(row.total_deaths),
      // Recovery fields are not present in all OWID catalog builds; parse when available.
      new_recovered: num((row as any).new_recovered),
      total_recovered: num((row as any).total_recovered),
      new_vaccinations: num(row.new_vaccinations),
      people_vaccinated: num(row.people_vaccinated),
      people_fully_vaccinated: num(row.people_fully_vaccinated),
      population: num(row.population),
    };

    const existing = blocks.get(iso);
    if (!existing) {
      blocks.set(iso, {
        iso_code: iso,
        location,
        continent,
        data: [day],
      });
    } else {
      existing.data = existing.data ?? [];
      existing.data.push(day);
    }
  }

  return Array.from(blocks.values());
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export type CovidSource =
  | {
      sourceName:
        | "Our World in Data (Catalog compact dataset)"
        | "RifqiMT/COVID-19 (JHU CSSE time series)";
      sourceUrl: string;
      dataThroughDate: string;
      raw: OwidRawBlock[];
    }
  | {
      sourceUrl: typeof OWID_JSON_URL;
      dataThroughDate: string;
      raw: unknown;
    }
  | {
      sourceUrl: typeof OWID_COMPACT_CSV_URL;
      sourceName: "Our World in Data (Catalog compact dataset)";
      dataThroughDate: string;
      raw: OwidRawBlock[];
    };

type IsoLookup = Map<
  string,
  { iso3: string; country: string; population: number | null; lat: number | null; lng: number | null }
>;

async function fetchIsoLookup(url: string): Promise<IsoLookup> {
  const res = await fetch(url, {
    headers: { Accept: "text/csv" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok || !res.body) {
    throw new Error(
      `Lookup table fetch failed: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const out: IsoLookup = new Map();
  const nodeStream = Readable.fromWeb(res.body as any);
  const parser = nodeStream.pipe(parse({ columns: true, skip_empty_lines: true }));
  for await (const row of parser) {
    const iso3 = String(row.iso3 ?? "").toUpperCase();
    const country = String(row.Country_Region ?? "");
    if (!iso3 || !/^[A-Z]{3}$/.test(iso3) || !country) continue;
    // Keep one row per country-level entry (Admin2/Province empty), but if multiple exist,
    // the later rows won't break correctness for population/lat/lng.
    const admin2 = String(row.Admin2 ?? "");
    const prov = String(row.Province_State ?? "");
    if (admin2 || prov) continue;
    out.set(country, {
      iso3,
      country,
      population: num(row.Population),
      lat: num(row.Lat),
      lng: num(row.Long_),
    });
  }
  return out;
}

function mmddyyToIso(d: string): string {
  // JHU columns like "1/22/20"
  const [m, day, yy] = d.split("/");
  const year = Number(yy) >= 70 ? `19${yy}` : `20${yy}`;
  const mm = String(m).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

async function fetchJhuTimeSeries(
  url: string,
): Promise<{ dates: string[]; byCountry: Map<string, number[]> }> {
  const res = await fetch(url, {
    headers: { Accept: "text/csv" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok || !res.body) {
    throw new Error(`Time series fetch failed: HTTP ${res.status} ${res.statusText}`);
  }

  const nodeStream = Readable.fromWeb(res.body as any);
  const parser = nodeStream.pipe(parse({ columns: true, skip_empty_lines: true }));

  let dateCols: string[] = [];
  let dates: string[] = [];
  const byCountry = new Map<string, number[]>();

  for await (const row of parser) {
    const country = String(row["Country/Region"] ?? "");
    if (!country) continue;

    if (dates.length === 0) {
      // Extract date columns once from first parsed row.
      // The parsed object has keys like:
      // Province/State, Country/Region, Lat, Long, 1/22/20, ...
      const keys = Object.keys(row);
      const longIdx = keys.indexOf("Long");
      dateCols =
        longIdx >= 0
          ? keys.slice(longIdx + 1)
          : keys.filter((k) => /\d+\/\d+\/\d+/.test(k));
      dates = dateCols.map(mmddyyToIso);
    }

    const series = byCountry.get(country) ?? new Array(dates.length).fill(0);
    for (let i = 0; i < dateCols.length; i++) {
      const v = Number(row[dateCols[i]] ?? 0);
      series[i] += Number.isFinite(v) ? v : 0;
    }
    byCountry.set(country, series);
  }

  return { dates, byCountry };
}

async function fetchRifqiRepoAsBlocks(): Promise<OwidRawBlock[]> {
  const [lookup, confirmed, deaths, recovered] = await Promise.all([
    fetchIsoLookup(RIFQI_UID_LOOKUP_CSV),
    fetchJhuTimeSeries(RIFQI_CONFIRMED_GLOBAL_CSV),
    fetchJhuTimeSeries(RIFQI_DEATHS_GLOBAL_CSV),
    fetchJhuTimeSeries(RIFQI_RECOVERED_GLOBAL_CSV),
  ]);

  // Use intersection of dates (they should match)
  const dates = confirmed.dates.length >= deaths.dates.length ? deaths.dates : confirmed.dates;

  const blocks: OwidRawBlock[] = [];

  for (const [country, confSeries] of confirmed.byCountry) {
    const deathSeries = deaths.byCountry.get(country) ?? new Array(confSeries.length).fill(0);
    const recSeries = recovered.byCountry.get(country) ?? new Array(confSeries.length).fill(0);
    const meta = lookup.get(country);
    if (!meta?.iso3) continue;

    const data: OwidRawDay[] = [];
    for (let i = 0; i < dates.length && i < confSeries.length; i++) {
      const totalCases = confSeries[i] ?? 0;
      const totalDeaths = deathSeries[i] ?? 0;
      const totalRecovered = recSeries[i] ?? 0;
      const prevCases = i > 0 ? confSeries[i - 1] ?? 0 : 0;
      const prevDeaths = i > 0 ? deathSeries[i - 1] ?? 0 : 0;
      const prevRecovered = i > 0 ? recSeries[i - 1] ?? 0 : 0;
      data.push({
        date: dates[i],
        total_cases: totalCases,
        total_deaths: totalDeaths,
        total_recovered: totalRecovered,
        new_cases: Math.max(0, totalCases - prevCases),
        new_deaths: Math.max(0, totalDeaths - prevDeaths),
        new_recovered: Math.max(0, totalRecovered - prevRecovered),
        population: meta.population,
      });
    }

    blocks.push({
      iso_code: meta.iso3,
      location: meta.country,
      continent: undefined,
      lat: meta.lat,
      lng: meta.lng,
      data,
    });
  }

  return blocks;
}

// Vaccination enrichment used to merge separate sources. The app now prefers OWID as the
// single source of truth, so this is no longer needed.

function mergeRecoveredAndGeo(
  base: OwidRawBlock[],
  mirror: OwidRawBlock[],
): void {
  const mirrorByIso = new Map<string, OwidRawBlock>();
  for (const b of mirror) {
    const iso = String(b.iso_code ?? "").toUpperCase();
    if (iso) mirrorByIso.set(iso, b);
  }

  for (const b of base) {
    const iso = String(b.iso_code ?? "").toUpperCase();
    const m = mirrorByIso.get(iso);
    if (!m) continue;

    // Best-effort geo enrichment (helps map coverage when OWID blocks omit it).
    if (b.lat == null && m.lat != null) b.lat = m.lat;
    if (b.lng == null && m.lng != null) b.lng = m.lng;

    const baseDays = b.data ?? [];
    const mirrorDays = m.data ?? [];
    if (baseDays.length === 0 || mirrorDays.length === 0) continue;

    const byDate = new Map<string, OwidRawDay>();
    for (const d of baseDays) {
      if (d?.date) byDate.set(d.date, d);
    }

    for (const md of mirrorDays) {
      if (!md?.date) continue;
      const bd = byDate.get(md.date);
      if (!bd) continue; // keep base timeline authoritative

      const mirrorHasRecovered =
        md.total_recovered != null || md.new_recovered != null;
      // Some OWID blocks contain `0` for recovered after reporting stops, which looks like
      // a hard reset. Treat 0 as "missing" if the mirror has a positive recovered value.
      const baseRecoveredLooksMissing =
        bd.total_recovered == null ||
        bd.new_recovered == null ||
        (bd.total_recovered === 0 &&
          ((md.total_recovered ?? 0) > 0 || (md.new_recovered ?? 0) > 0));
      if (mirrorHasRecovered && baseRecoveredLooksMissing) {
        if (bd.total_recovered == null || bd.total_recovered === 0) {
          bd.total_recovered =
            md.total_recovered ?? bd.total_recovered ?? null;
        }
        if (bd.new_recovered == null || bd.new_recovered === 0) {
          bd.new_recovered = md.new_recovered ?? bd.new_recovered ?? null;
        }
      }

      if (bd.population == null && md.population != null) {
        bd.population = md.population;
      }
    }

    b.data = [...baseDays].sort((a, c) =>
      String(a.date).localeCompare(String(c.date)),
    );
  }
}

/**
 * Fetches COVID data from OWID using multiple fallbacks:
 * 1) Legacy JSON (preferred when reachable).
 * 2) OWID Catalog compact CSV (more likely to work when the `covid.*` subdomain has DNS issues).
 */
export async function fetchCovidSource(): Promise<CovidSource> {
  // 1) Single source of truth: OWID Catalog (most reliably up-to-date).
  try {
    const raw = await fetchCompactCsvAsBlocks(OWID_COMPACT_CSV_URL);
    // Recovery metrics are often missing in OWID; enrich them from the GitHub mirror when possible.
    try {
      const mirror = await fetchRifqiRepoAsBlocks();
      mergeRecoveredAndGeo(raw, mirror);
    } catch {
      // Best-effort enrichment only.
    }
    const dataThroughDate =
      raw.reduce<string | null>((acc, b) => {
        const last = b.data?.[b.data.length - 1]?.date ?? null;
        if (!last) return acc;
        if (!acc || last > acc) return last;
        return acc;
      }, null) ?? new Date().toISOString().slice(0, 10);
    return {
      sourceUrl: OWID_COMPACT_CSV_URL,
      sourceName: "Our World in Data (Catalog compact dataset)",
      dataThroughDate,
      raw,
    };
  } catch {
    // fall through to legacy and repo mirrors
  }

  // 2) Fallback to legacy OWID JSON if catalog is unavailable.
  try {
    const raw = await fetchJsonWithRetries(OWID_JSON_URL);
    // Data-through date isn't trivial to extract without scanning; assume today for JSON path.
    return {
      sourceUrl: OWID_JSON_URL,
      dataThroughDate: new Date().toISOString().slice(0, 10),
      raw,
    };
  } catch (e) {
    const first = formatOwidFetchError(e);
    try {
      // 3) Last fallback: GitHub mirror (may lag OWID, but better than nothing).
      const raw = await fetchRifqiRepoAsBlocks();
      const dataThroughDate =
        raw.reduce<string | null>((acc, b) => {
          const last = b.data?.[b.data.length - 1]?.date ?? null;
          if (!last) return acc;
          if (!acc || last > acc) return last;
          return acc;
        }, null) ?? new Date().toISOString().slice(0, 10);
      return {
        sourceUrl: "https://github.com/RifqiMT/COVID-19",
        sourceName: "RifqiMT/COVID-19 (JHU CSSE time series)",
        dataThroughDate,
        raw,
      };
    } catch (e2) {
      const second = formatOwidFetchError(e2);
      throw new Error(
        [
          "All COVID data sources failed.",
          `JSON: ${first.message}`,
          `GitHub mirror: ${second.message}`,
        ].join(" "),
      );
    }
  }
}
