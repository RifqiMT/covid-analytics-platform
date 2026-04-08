import {
  fetchCovidSource,
  OWID_COMPACT_CSV_URL,
  OWID_JSON_URL,
  type CovidSource,
} from "@/lib/services/owidRemoteFetch";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export { OWID_COMPACT_CSV_URL, OWID_JSON_URL };

/**
 * In-memory cache for the COVID source.
 *
 * Why not `unstable_cache`?
 * Next.js' data cache has a hard limit (2MB per item in dev), and our dataset can be tens of MB.
 * This cache keeps the app reliable while still avoiding repeated downloads.
 *
 * Note: In serverless/prod this is per-instance memory. That's fine for a dashboard; it degrades
 * to re-fetching per cold start.
 */
// Shorter TTL so the dashboard picks up new daily drops faster.
const TTL_MS = 10 * 60 * 1000;
// Best-effort disk cache across dev restarts (helps avoid repeated 50MB downloads/parses).
// Keep a longer TTL here because it's only used when memory cache is cold.
const DISK_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type CacheState = {
  fetchedAtMs: number;
  value: CovidSource;
} | null;

declare global {
  // eslint-disable-next-line no-var
  var __covidSourceCache: CacheState | undefined;
  // eslint-disable-next-line no-var
  var __covidSourceCacheInFlight: Promise<CovidSource> | undefined;
}

function nowMs(): number {
  return Date.now();
}

type DiskCachePayload = {
  fetchedAtMs: number;
  value: CovidSource;
};

function diskCachePath(): string {
  // Keep it under .next so it’s clearly build-artifact/cache data.
  return path.join(process.cwd(), ".next", "cache", "covid-source.json");
}

async function readDiskCache(): Promise<DiskCachePayload | null> {
  try {
    const p = diskCachePath();
    const raw = await readFile(p, "utf8");
    const parsed = JSON.parse(raw) as Partial<DiskCachePayload> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.fetchedAtMs !== "number" || !parsed.value) return null;
    if (nowMs() - parsed.fetchedAtMs > DISK_MAX_AGE_MS) return null;
    return parsed as DiskCachePayload;
  } catch {
    return null;
  }
}

async function writeDiskCache(payload: DiskCachePayload): Promise<void> {
  try {
    const p = diskCachePath();
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, JSON.stringify(payload), "utf8");
  } catch {
    // Best-effort only (serverless/locked FS should not break the app).
  }
}

export async function getCachedOwidDocument(): Promise<CovidSource> {
  const cached = globalThis.__covidSourceCache ?? null;
  if (cached && nowMs() - cached.fetchedAtMs < TTL_MS) {
    return cached.value;
  }

  // If memory cache is cold (e.g., dev restart), prefer a valid disk cache immediately.
  // This avoids repeated downloads/parses and reduces intermittent "fetch failed" issues.
  if (!cached) {
    const disk = await readDiskCache();
    if (disk) {
      globalThis.__covidSourceCache = disk;
      return disk.value;
    }
  }

  if (!globalThis.__covidSourceCacheInFlight) {
    globalThis.__covidSourceCacheInFlight = (async () => {
      try {
        const value = await fetchCovidSource();
        const payload = { fetchedAtMs: nowMs(), value };
        globalThis.__covidSourceCache = payload;
        await writeDiskCache(payload);
        return value;
      } catch (e) {
        // If network fetch fails, fall back to disk cache even if slightly older.
        const disk = await readDiskCache();
        if (disk) {
          globalThis.__covidSourceCache = disk;
          return disk.value;
        }
        throw e;
      }
    })().finally(() => {
      globalThis.__covidSourceCacheInFlight = undefined;
    });
  }

  return globalThis.__covidSourceCacheInFlight;
}

export async function getCachedOwidDocumentFresh(): Promise<CovidSource> {
  // Force a refresh (ignore TTL), but still single-flight.
  globalThis.__covidSourceCache = null;
  return getCachedOwidDocument();
}
