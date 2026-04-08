import { NextRequest, NextResponse } from "next/server";
import { normalizeDateRange } from "@/lib/dateRange";
import {
  createCovidAnalyticsService,
  type BuildCovidDashboardInput,
} from "@/lib/services/CovidAnalyticsService";
import { OwidCovidParser } from "@/lib/services/OwidCovidParser";
import {
  getCachedOwidDocument,
  getCachedOwidDocumentFresh,
} from "@/lib/services/owidCachedFetch";
import type { TimeGranularity } from "@/lib/types/covid";

export const dynamic = "force-dynamic";
/** Large OWID JSON parse + download (Vercel / serverless). */
export const maxDuration = 120;

/**
 * Small in-memory response cache for expensive aggregations.
 * This avoids recomputing (237 countries × many buckets) on rapid UI interactions.
 *
 * Note: per-instance only (fine for dashboards). In dev, it also reduces CPU spikes.
 */
const RESPONSE_TTL_MS = 30_000;
type Cached = { atMs: number; value: unknown };
declare global {
  // eslint-disable-next-line no-var
  var __covidApiCache: Map<string, Cached> | undefined;
  // eslint-disable-next-line no-var
  var __covidApiCacheInFlight: Map<string, Promise<unknown>> | undefined;
}

function cacheMaps() {
  const cache = (globalThis.__covidApiCache ??= new Map());
  const inflight = (globalThis.__covidApiCacheInFlight ??= new Map());
  return { cache, inflight };
}

const GRANULARITIES: TimeGranularity[] = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annually",
];

function pickTopIsoByTotalCasesAtTo(
  raw: unknown,
  dateTo: string,
  topN: number,
): string[] {
  const blocks = OwidCovidParser.parseBlocks(raw);
  const scored: Array<{ iso: string; v: number }> = [];
  for (const b of blocks) {
    const iso = String(b.iso_code ?? "").toUpperCase();
    if (!iso || iso.startsWith("OWID") || !/^[A-Z]{3}$/.test(iso)) continue;
    const days = b.data ?? [];
    if (days.length === 0) continue;
    // Find latest day <= dateTo.
    let i = days.length - 1;
    while (i >= 0 && String(days[i]?.date ?? "") > dateTo) i--;
    const d = i >= 0 ? days[i] : null;
    const vRaw = d?.total_cases;
    const v = typeof vRaw === "number" && Number.isFinite(vRaw) ? vRaw : 0;
    scored.push({ iso, v });
  }
  scored.sort((a, b) => b.v - a.v || a.iso.localeCompare(b.iso));
  return scored.slice(0, topN).map((x) => x.iso);
}

function isGranularity(v: string | null): v is TimeGranularity {
  return !!v && (GRANULARITIES as string[]).includes(v);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const granularityRaw = searchParams.get("granularity") ?? "monthly";
  const rawFrom = searchParams.get("from") ?? "2020-01-01";
  const rawTo =
    searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const countriesParam = searchParams.get("countries");
  const preset = searchParams.get("preset"); // e.g. "top15"
  const refresh = searchParams.get("refresh") === "1";
  const mirrorLatest = (searchParams.get("mirrorLatest") ?? "1") === "1";

  const { dateFrom, dateTo, rangeNotes } = normalizeDateRange(rawFrom, rawTo);

  if (!isGranularity(granularityRaw)) {
    return NextResponse.json(
      { error: "Invalid granularity", allowed: GRANULARITIES },
      { status: 400 },
    );
  }

  const isoAlpha3Filter = countriesParam
    ? countriesParam
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
    : [];

  const input: BuildCovidDashboardInput = {
    isoAlpha3Filter,
    dateFrom,
    dateTo,
    granularity: granularityRaw,
    mirrorLatestToToday: mirrorLatest,
  };

  try {
    const fetchedAt = new Date().toISOString();
    const src = refresh
      ? await getCachedOwidDocumentFresh()
      : await getCachedOwidDocument();
    const service = createCovidAnalyticsService();
    // Clamp to the latest available date only when mirroring is disabled.
    const requestedTo = input.dateTo;
    const requestedFrom = input.dateFrom;
    if (!mirrorLatest && input.dateTo > src.dataThroughDate) {
      input.dateTo = src.dataThroughDate;
      if (input.dateFrom > input.dateTo) input.dateFrom = input.dateTo;
    }

    // Performance preset: when no explicit countries are selected, Charts view can ask for top 15 only.
    // This avoids aggregating hundreds of countries when the UI only renders a small subset anyway.
    if (preset === "top15" && input.isoAlpha3Filter.length === 0) {
      input.isoAlpha3Filter = pickTopIsoByTotalCasesAtTo(src.raw, input.dateTo, 15);
    }
    // Cache key includes the effective query + current upstream dataThroughDate.
    // `refresh=1` bypasses this cache.
    const cacheKey = JSON.stringify({
      g: input.granularity,
      from: input.dateFrom,
      to: input.dateTo,
      mirrorLatest,
      countries: input.isoAlpha3Filter,
      preset,
      dataThrough: src.dataThroughDate,
      sourceUrl: src.sourceUrl,
    });

    let cachedHit = false;
    let body: any;
    if (!refresh) {
      const { cache, inflight } = cacheMaps();
      const hit = cache.get(cacheKey);
      if (hit && Date.now() - hit.atMs < RESPONSE_TTL_MS) {
        cachedHit = true;
        body = hit.value;
      } else if (inflight.has(cacheKey)) {
        body = await inflight.get(cacheKey);
      } else {
        const p = (async () => service.buildFromOwidDocument(src.raw, input, fetchedAt))()
          .then((v) => {
            cache.set(cacheKey, { atMs: Date.now(), value: v });
            return v;
          })
          .finally(() => {
            inflight.delete(cacheKey);
          });
        inflight.set(cacheKey, p);
        body = await p;
      }
    } else {
      body = service.buildFromOwidDocument(src.raw, input, fetchedAt);
    }

    body.meta.sourceUrl = src.sourceUrl;
    body.meta.dataThroughDate = src.dataThroughDate;
    body.meta.requestedFrom = requestedFrom;
    body.meta.requestedTo = requestedTo;
    body.meta.effectiveFrom = input.dateFrom;
    body.meta.effectiveTo = input.dateTo;
    body.meta.notes = [
      preset === "top15" && countriesParam == null
        ? "Performance mode: charts requested top 15 countries (by total cases at period end) instead of all countries."
        : null,
      requestedTo > src.dataThroughDate
        ? mirrorLatest
          ? `Upstream data-through is ${src.dataThroughDate}. Values after that date are forward-filled to ${requestedTo} (cumulative values carried forward; new_* = 0).`
          : `Requested end date ${requestedTo} was clamped to ${src.dataThroughDate} because upstream sources have not published later observations yet.`
        : `Requested end date ${requestedTo} is available in the current source.`,
      ...body.meta.notes,
    ].filter(Boolean);
    if ("sourceName" in src) {
      body.meta.sourceName = src.sourceName;
      body.meta.attribution =
        src.sourceName === "Our World in Data (Catalog compact dataset)"
          ? "Our World in Data compiles COVID-19 indicators from official reporting (including WHO-linked sources where cited) and publishes them via the OWID catalog."
          : "Mirror source (may lag): RifqiMT/COVID-19 (JHU CSSE-style time series).";
    }
    if (rangeNotes.length > 0) {
      body.meta.notes = [...rangeNotes, ...body.meta.notes];
    }
    return NextResponse.json(body, {
      headers: {
        "x-covid-cache": refresh ? "bypass" : cachedHit ? "hit" : "miss",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/covid]", message, e);
    return NextResponse.json(
      {
        error: "Failed to load COVID data",
        detail: message,
        hint: "The app downloads a large file from Our World in Data. Check your network or try again in a minute.",
      },
      { status: 502 },
    );
  }
}
