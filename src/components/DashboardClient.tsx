"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CovidApiResponse, TimeGranularity } from "@/lib/types/covid";
import { MetricsChart } from "@/components/MetricsChart";
import { MetricsTable } from "@/components/MetricsTable";

const CovidWorldMap = dynamic(() => import("@/components/CovidWorldMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-lg border border-surface-muted bg-surface-card text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

const GRANULARITIES: TimeGranularity[] = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annually",
];

const DEFAULT_FOCUS: string[] = ["USA", "GBR", "DEU", "FRA", "IDN", "BRA"];
const MAJOR_10_FOCUS: string[] = [
  "BRA",
  "FRA",
  "DEU",
  "IDN",
  "GBR",
  "USA",
  "IND",
  "CHN",
  "AUS",
  "NGA",
];

type ChartMetric =
  | "newCasesSum"
  | "newDeathsSum"
  | "newRecoveredSum"
  | "totalCasesEnd"
  | "totalDeathsEnd"
  | "totalRecoveredEnd"
  | "infectionRatePer100k"
  | "infectionRatePercent"
  | "deathRatePer100k"
  | "recoveryRatePer100k"
  | "recoveryRatePercent"
  | "mortalityRatePercent"
  | "vaccinationRatePercent";

type MapMetric =
  | "newCasesSum"
  | "newDeathsSum"
  | "newRecoveredSum"
  | "totalCasesEnd"
  | "totalDeathsEnd"
  | "totalRecoveredEnd"
  | "infectionRatePer100k"
  | "infectionRatePercent"
  | "deathRatePer100k"
  | "recoveryRatePer100k"
  | "recoveryRatePercent"
  | "mortalityRatePercent"
  | "vaccinationRatePercent";

export function DashboardClient() {
  const todayIso = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );

  const [granularity, setGranularity] =
    useState<TimeGranularity>("monthly");
  const [from, setFrom] = useState("2020-01-01");
  const [to, setTo] = useState(() => todayIso);
  const [selectedAlpha3, setSelectedAlpha3] =
    useState<string[]>(DEFAULT_FOCUS);
  const [chartMetric, setChartMetric] =
    useState<ChartMetric>("infectionRatePer100k");
  const [mapMetric, setMapMetric] =
    useState<MapMetric>("infectionRatePer100k");
  const [activeView, setActiveView] = useState<"map" | "charts" | "table">(
    "charts",
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [data, setData] = useState<CovidApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countryCatalog, setCountryCatalog] = useState<
    { code: string; name: string }[]
  >([]);
  const [countryQuery, setCountryQuery] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [confirmBulkSelectAll, setConfirmBulkSelectAll] = useState(false);
  const scope: "all" | "selected" = selectedAlpha3.length === 0 ? "all" : "selected";

  const selectedSet = useMemo(
    () => new Set(selectedAlpha3.map((c) => c.toUpperCase())),
    [selectedAlpha3],
  );

  const load = useCallback(
    async (opts?: { forceRefresh?: boolean }) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      granularity,
      from,
      to,
    });
    if (selectedAlpha3.length > 0) {
      params.set("countries", selectedAlpha3.join(","));
    } else if (activeView === "charts") {
      // Charts only renders a small subset when in "All countries" mode; ask server for the fast preset.
      params.set("preset", "top15");
    }
    if (opts?.forceRefresh) {
      params.set("refresh", "1");
    }
    // Keep the UI "as-of today" by mirroring the latest upstream values forward.
    params.set("mirrorLatest", "1");
    try {
      const res = await fetch(`/api/covid?${params.toString()}`, {
        cache: "no-store",
      });
      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        throw new Error(
          "The server did not return JSON. Confirm `npm run dev` is running for covid-analytics-platform.",
        );
      }
      const json = parsed as CovidApiResponse & {
        error?: string;
        detail?: string;
        hint?: string;
      };
      if (!res.ok) {
        const parts = [json.detail ?? json.error, json.hint].filter(Boolean);
        throw new Error(
          parts.join(" — ") || `Request failed (${res.status})`,
        );
      }
      setData(json as CovidApiResponse);
      // Keep the UI aligned to the true latest available date (clamped by API).
      if (json?.meta?.effectiveFrom && json.meta.effectiveFrom !== from) {
        setFrom(json.meta.effectiveFrom);
      }
      if (json?.meta?.effectiveTo && json.meta.effectiveTo !== to) {
        setTo(json.meta.effectiveTo);
      }
    } catch (e) {
      setData(null);
      const raw = e instanceof Error ? e.message : "Failed to load data";
      if (raw === "fetch failed" || raw.toLowerCase().includes("failed to fetch")) {
        setError(
          "Could not reach this app’s API (network error). If the dev server restarted, reload the page. Firewall/VPN can also block localhost.",
        );
      } else {
        setError(raw);
      }
    } finally {
      setLoading(false);
    }
    },
    [activeView, from, granularity, selectedAlpha3, to],
  );

  useEffect(() => {
    // Default to cached sources for speed; use the "Force refresh sources" button when needed.
    void load({ forceRefresh: false });
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/covid/countries", {
          cache: "no-store",
        });
        const json = (await res.json()) as {
          countries?: { code: string; name: string }[];
          error?: string;
          hint?: string;
        };
        if (!res.ok || !json.countries) return;
        if (!cancelled) setCountryCatalog(json.countries);
      } catch {
        /* catalog is optional; dashboard still works with typed codes */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const countryOptions = countryCatalog;
  const countryNameByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of countryOptions) m.set(c.code.toUpperCase(), c.name);
    return m;
  }, [countryOptions]);

  const filteredCountryOptions = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    let base = countryOptions;
    if (showSelectedOnly) {
      base = base.filter((c) => selectedSet.has(c.code.toUpperCase()));
    }
    if (!q) return base;
    return base.filter((c) => {
      const hay = `${c.name} ${c.code}`.toLowerCase();
      return hay.includes(q);
    });
  }, [countryOptions, countryQuery, selectedSet, showSelectedOnly]);

  const selectedShownCount = useMemo(() => {
    const shownSet = new Set(
      filteredCountryOptions.map((c) => c.code.toUpperCase()),
    );
    let count = 0;
    for (const code of selectedSet) {
      if (shownSet.has(code)) count++;
    }
    return count;
  }, [filteredCountryOptions, selectedSet]);

  useEffect(() => {
    if (!confirmBulkSelectAll) return;
    const t = setTimeout(() => setConfirmBulkSelectAll(false), 5000);
    return () => clearTimeout(t);
  }, [confirmBulkSelectAll]);

  const supportsVaccination = data?.meta?.supportsVaccination ?? false;

  useEffect(() => {
    // If current metric becomes unsupported (e.g. switched source), fall back to a supported one.
    if (!supportsVaccination) {
      if (chartMetric === "vaccinationRatePercent") {
        setChartMetric("infectionRatePer100k");
      }
      if (mapMetric === "vaccinationRatePercent") {
        setMapMetric("infectionRatePer100k");
      }
    }
  }, [chartMetric, mapMetric, supportsVaccination]);

  const toggleCountry = (code: string) => {
    const u = code.toUpperCase();
    setSelectedAlpha3((prev) =>
      prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u],
    );
  };

  return (
    <div className="w-full px-4 py-8 md:px-6 md:py-10 lg:px-8">
      {/* Top app bar */}
      <header className="sticky top-0 z-20 -mx-4 border-b border-surface-muted bg-white/70 px-4 py-4 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-accent-strong">
              COVID analytics
            </p>
            <h1 className="truncate text-2xl font-semibold text-slate-900 md:text-3xl">
              Country metrics dashboard
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-surface-muted bg-white shadow-sm">
              <button
                type="button"
                className={[
                  "px-3 py-1.5 text-xs font-semibold",
                  activeView === "charts"
                    ? "bg-surface-card text-slate-900"
                    : "bg-white text-slate-700 hover:bg-surface-card/60",
                ].join(" ")}
                onClick={() => setActiveView("charts")}
                aria-pressed={activeView === "charts"}
              >
                Charts
              </button>
              <button
                type="button"
                className={[
                  "px-3 py-1.5 text-xs font-semibold",
                  activeView === "map"
                    ? "bg-surface-card text-slate-900"
                    : "bg-white text-slate-700 hover:bg-surface-card/60",
                ].join(" ")}
                onClick={() => setActiveView("map")}
                aria-pressed={activeView === "map"}
              >
                Map
              </button>
              <button
                type="button"
                className={[
                  "px-3 py-1.5 text-xs font-semibold",
                  activeView === "table"
                    ? "bg-surface-card text-slate-900"
                    : "bg-white text-slate-700 hover:bg-surface-card/60",
                ].join(" ")}
                onClick={() => setActiveView("table")}
                aria-pressed={activeView === "table"}
              >
                Table
              </button>
            </div>

            <button
              type="button"
              className="rounded-lg border border-surface-muted bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-surface-card md:hidden"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
            >
              {filtersOpen ? "Hide filters" : "Show filters"}
            </button>

            <span className="hidden rounded-full border border-surface-muted bg-white px-3 py-1 text-xs text-slate-700 md:inline-flex">
              Countries{" "}
              <span className="ml-1 font-semibold text-slate-900">
                {selectedAlpha3.length === 0 ? "All" : selectedAlpha3.length}
              </span>
            </span>
            {data?.meta?.dataThroughDate && (
              <span className="hidden rounded-full border border-surface-muted bg-white px-3 py-1 text-xs text-slate-700 md:inline-flex">
                Data through{" "}
                <span className="ml-1 font-semibold text-slate-900">
                  {data.meta.dataThroughDate}
                </span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Filters */}
      <section
        className={[
          "mt-6 rounded-2xl border border-surface-muted bg-white/70 p-4 shadow-lg backdrop-blur md:p-6",
          filtersOpen ? "block" : "hidden",
          "md:block",
        ].join(" ")}
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Filters</p>
            <p className="mt-1 text-xs text-slate-600">
              Configure time range, countries, and refresh behavior.
            </p>
          </div>
          <div className="text-xs text-slate-600 md:hidden">
            <button
              type="button"
              className="rounded-lg border border-surface-muted bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-surface-card"
              onClick={() => setFiltersOpen(false)}
            >
              Done
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Granularity
            <select
              className="rounded-lg border border-surface-muted bg-surface-input px-3 py-2 text-slate-900 shadow-sm"
              value={granularity}
              onChange={(e) =>
                setGranularity(e.target.value as TimeGranularity)
              }
            >
              {GRANULARITIES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            From
            <input
              type="date"
              className="rounded-lg border border-surface-muted bg-surface-input px-3 py-2 text-slate-900 shadow-sm"
              value={from}
              max={to > todayIso ? todayIso : to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            To
            <input
              type="date"
              className="rounded-lg border border-surface-muted bg-surface-input px-3 py-2 text-slate-900 shadow-sm"
              value={to}
              min={from}
              max={todayIso}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-slate-700">Quick sets</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-200"
                onClick={() => setSelectedAlpha3(DEFAULT_FOCUS)}
              >
                Major six focus
              </button>
              <button
                type="button"
                className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-200"
                onClick={() => setSelectedAlpha3(MAJOR_10_FOCUS)}
              >
                Major 10 focus
              </button>
              <button
                type="button"
                className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-200"
                onClick={() => setSelectedAlpha3([])}
              >
                All countries
              </button>
            </div>
          </div>
        </div>

        {countryOptions.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Countries</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="rounded-full border border-surface-muted bg-white px-3 py-1">
                    <span className="font-medium text-slate-900">
                      {scope === "all"
                        ? "All countries"
                        : `${selectedAlpha3.length} selected`}
                    </span>
                  </span>
                  <span className="text-slate-500">
                    Switch to <span className="font-medium">Selected</span> to compare a focused set.
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-lg border border-surface-muted bg-white shadow-sm">
                  <button
                    type="button"
                    className={[
                      "px-3 py-1.5 text-xs font-semibold",
                      scope === "all"
                        ? "bg-surface-card text-slate-900"
                        : "bg-white text-slate-700 hover:bg-surface-card/60",
                    ].join(" ")}
                    onClick={() => setSelectedAlpha3([])}
                    aria-pressed={scope === "all"}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={[
                      "px-3 py-1.5 text-xs font-semibold",
                      scope === "selected"
                        ? "bg-surface-card text-slate-900"
                        : "bg-white text-slate-700 hover:bg-surface-card/60",
                    ].join(" ")}
                    onClick={() => {
                      // If the user switches into Selected mode from All, start with a sensible default set.
                      setSelectedAlpha3((prev) => (prev.length === 0 ? DEFAULT_FOCUS : prev));
                    }}
                    aria-pressed={scope === "selected"}
                  >
                    Selected
                  </button>
                </div>
              </div>
            </div>

            {scope === "selected" && (
              <div className="mt-3 space-y-3">
                {/* Toolbar */}
                <div className="flex flex-col gap-2 rounded-xl border border-surface-muted bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <div className="min-w-[260px]">
                      <label className="block text-xs font-medium text-slate-700">
                        Search countries
                      </label>
                      <input
                        value={countryQuery}
                        onChange={(e) => setCountryQuery(e.target.value)}
                        placeholder="Search by name or ISO3…"
                        className="mt-1 w-full rounded-lg border border-surface-muted bg-surface-input px-3 py-2 text-sm text-slate-900"
                      />
                    </div>
                    <label className="mt-1 inline-flex items-center gap-2 text-sm text-slate-700 md:mt-6">
                      <input
                        type="checkbox"
                        checked={showSelectedOnly}
                        onChange={(e) => setShowSelectedOnly(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                      />
                      <span className="text-xs">Show selected only</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-surface-card px-3 py-1 text-xs text-slate-700">
                      Showing{" "}
                      <span className="font-semibold text-slate-900">
                        {filteredCountryOptions.length}
                      </span>
                      {selectedShownCount > 0 && (
                        <>
                          {" "}
                          · selected{" "}
                          <span className="font-semibold text-slate-900">
                            {selectedShownCount}
                          </span>
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCountryQuery("");
                        setShowSelectedOnly(false);
                        setConfirmBulkSelectAll(false);
                      }}
                      className="rounded-lg border border-surface-muted bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-surface-card"
                      title="Reset filters"
                    >
                      Reset filters
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-200"
                      onClick={() => {
                        const shownCount = filteredCountryOptions.length;
                        const needsConfirm =
                          shownCount >= 75 && countryQuery.trim().length === 0 && !showSelectedOnly;
                        if (needsConfirm && !confirmBulkSelectAll) {
                          setConfirmBulkSelectAll(true);
                          return;
                        }
                        setConfirmBulkSelectAll(false);
                        const toAdd = filteredCountryOptions.map((c) =>
                          c.code.toUpperCase(),
                        );
                        setSelectedAlpha3((prev) => {
                          const set = new Set(prev);
                          for (const code of toAdd) set.add(code);
                          return Array.from(set);
                        });
                      }}
                      disabled={filteredCountryOptions.length === 0}
                      title={
                        filteredCountryOptions.length >= 75 &&
                        countryQuery.trim().length === 0 &&
                        !showSelectedOnly
                          ? "This will select many countries. Use search to narrow first."
                          : "Select all countries currently shown in the list"
                      }
                    >
                      {confirmBulkSelectAll
                        ? `Click again to select ${filteredCountryOptions.length}`
                        : "Select shown"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-surface-muted bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-surface-card"
                      onClick={() => {
                        const toRemove = new Set(
                          filteredCountryOptions.map((c) =>
                            c.code.toUpperCase(),
                          ),
                        );
                        setSelectedAlpha3((prev) =>
                          prev.filter((c) => !toRemove.has(c)),
                        );
                        setConfirmBulkSelectAll(false);
                      }}
                      disabled={filteredCountryOptions.length === 0 || selectedShownCount === 0}
                    >
                      Clear shown
                    </button>
                  </div>
                </div>

                {/* Selected chips */}
                {selectedAlpha3.length > 0 && (
                  <div className="rounded-xl border border-surface-muted bg-white p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-700">
                        Selected ({selectedAlpha3.length})
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedAlpha3([])}
                        className="text-xs font-medium text-accent-strong hover:underline"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedAlpha3.slice(0, 24).map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() =>
                            setSelectedAlpha3((prev) =>
                              prev.filter((c) => c !== code),
                            )
                          }
                          className="group inline-flex items-center gap-2 rounded-full border border-surface-muted bg-white px-3 py-1 text-xs text-slate-800 shadow-sm hover:border-slate-300"
                          title="Remove from selection"
                        >
                          <span className="font-medium">{code}</span>
                          <span className="text-slate-500">
                            {countryNameByCode.get(code) ?? ""}
                          </span>
                          <span className="text-slate-400 group-hover:text-slate-600">
                            ×
                          </span>
                        </button>
                      ))}
                      {selectedAlpha3.length > 24 && (
                        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs text-slate-700">
                          +{selectedAlpha3.length - 24} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* List */}
                <div
                  className="max-h-72 w-full overflow-auto rounded-xl border border-surface-muted bg-white shadow-sm"
                  aria-label="Country selector"
                >
                  {filteredCountryOptions.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-slate-500">
                      No countries match your search.
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {filteredCountryOptions.map((c) => {
                        const code = c.code.toUpperCase();
                        const checked = selectedSet.has(code);
                        return (
                          <li key={c.code}>
                            <label
                              className={[
                                "flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm",
                                checked
                                  ? "bg-surface-card text-slate-900"
                                  : "bg-white text-slate-800 hover:bg-surface-card/60",
                              ].join(" ")}
                            >
                              <span className="min-w-0">
                                <span className="font-medium">{c.name}</span>{" "}
                                <span className="text-xs text-slate-500">
                                  ({c.code})
                                </span>
                              </span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setSelectedAlpha3((prev) =>
                                    prev.includes(code)
                                      ? prev.filter((x) => x !== code)
                                      : [...prev, code],
                                  )
                                }
                                className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                              />
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div
            className="inline-flex overflow-hidden rounded-lg border border-surface-muted bg-white shadow-sm"
            role="group"
            aria-label="Refresh controls"
          >
            <button
              type="button"
              className="bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dim disabled:opacity-50"
              onClick={() => void load({ forceRefresh: false })}
              disabled={loading}
              title="Refresh using cached source when available"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              className="border-l border-surface-muted bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-surface-card disabled:opacity-50"
              onClick={() => void load({ forceRefresh: true })}
              disabled={loading}
              title="Bypass cache and re-fetch the latest from sources"
            >
              Force
            </button>
          </div>
          <span className="text-xs text-slate-500">
            {data?.meta?.fetchedAt
              ? `Last refreshed ${new Date(data.meta.fetchedAt).toLocaleString()}`
              : loading
                ? "Working…"
                : " "}
          </span>
        </div>
        {error && (
          <div
            className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-100"
            role="alert"
          >
            <p className="font-medium text-red-200">Could not load data</p>
            <p className="mt-1 text-red-100/90">{error}</p>
            <ul className="mt-2 list-inside list-disc text-xs text-red-200/80">
              <li>
                Wait for the first request to finish (large download, up to ~2
                minutes).
              </li>
              <li>
                Try &quot;Major six focus&quot; instead of all countries to reduce
                work after the file is cached.
              </li>
              <li>
                Confirm you can open{" "}
                <a
                  className="underline"
                  href="https://covid.ourworldindata.org/data/owid-covid-data.json"
                  rel="noreferrer"
                  target="_blank"
                >
                  the OWID dataset
                </a>{" "}
                in your browser (network / firewall).
              </li>
            </ul>
            <button
              type="button"
              className="mt-3 rounded-md bg-red-900/50 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-900/70"
              onClick={() => void load({ forceRefresh: true })}
            >
              Try again
            </button>
          </div>
        )}
        {loading && !data && !error && (
          <p className="mt-4 text-sm text-slate-400">
            Loading Our World in Data… First load after a server start can take
            up to two minutes while the dataset downloads.
          </p>
        )}
      </section>

      {data && (
        <section className="rounded-xl border border-surface-muted bg-white p-4 text-sm text-slate-700 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="font-medium text-slate-900">{data.meta.sourceName}</p>
              <p className="text-xs text-slate-600">{data.meta.attribution}</p>
              <p className="text-xs text-slate-500">
                Fetched {new Date(data.meta.fetchedAt).toLocaleString()} ·{" "}
                <a
                  className="text-accent-strong underline"
                  href={data.meta.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Dataset endpoint
                </a>
              </p>
            </div>
          </div>
          <ul className="mt-3 list-inside list-disc text-xs text-slate-600">
            {(() => {
              // Notes can legitimately contain repeated strings (e.g., range clamping + mirroring messages).
              // Deduping avoids confusing repeats, and using a positional key avoids collisions from string prefixes.
              const seen = new Set<string>();
              const unique = data.meta.notes.filter((n) => {
                if (seen.has(n)) return false;
                seen.add(n);
                return true;
              });
              return unique.map((n, i) => <li key={i}>{n}</li>);
            })()}
          </ul>
        </section>
      )}

      {data && !loading && (
        <>
          {activeView === "map" && (
            <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Map</h2>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Metric (latest bucket in range)
                <select
                  className="rounded-md border border-surface-muted bg-surface-input px-3 py-2 text-slate-900"
                  value={mapMetric}
                  onChange={(e) =>
                    setMapMetric(e.target.value as MapMetric)
                  }
                >
                  <optgroup label="Cumulative totals (period end)">
                    <option value="totalCasesEnd">Cases</option>
                    <option value="totalDeathsEnd">Deaths</option>
                    <option value="totalRecoveredEnd">Recovered</option>
                  </optgroup>
                  <optgroup label="Period change (latest bucket)">
                    <option value="newCasesSum">New cases (sum)</option>
                    <option value="newDeathsSum">New deaths (sum)</option>
                    <option value="newRecoveredSum">New recovered (sum)</option>
                  </optgroup>
                  <optgroup label="Rates">
                    <option value="infectionRatePer100k">Cases / 100k</option>
                    <option value="deathRatePer100k">Deaths / 100k</option>
                    <option value="recoveryRatePer100k">Recovered / 100k</option>
                    <option value="infectionRatePercent">Infected (%)</option>
                    <option value="recoveryRatePercent">Recovery rate (%)</option>
                    <option value="mortalityRatePercent">Mortality rate (%)</option>
                  </optgroup>
                  <optgroup label="Vaccination">
                    <option
                      value="vaccinationRatePercent"
                      disabled={!supportsVaccination}
                    >
                      Vaccinated (%) {!supportsVaccination ? "(unavailable)" : ""}
                    </option>
                  </optgroup>
                </select>
              </label>
            </div>
            <CovidWorldMap
              countries={data.countries}
              metric={mapMetric}
              selected={selectedSet}
            />
            </section>
          )}

          {activeView === "charts" && (
            <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Charts</h2>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Series
                <select
                  className="rounded-md border border-surface-muted bg-surface-input px-3 py-2 text-slate-900"
                  value={chartMetric}
                  onChange={(e) =>
                    setChartMetric(e.target.value as ChartMetric)
                  }
                >
                  <optgroup label="Rates">
                    <option value="infectionRatePer100k">Cases / 100k</option>
                    <option value="deathRatePer100k">Deaths / 100k</option>
                    <option value="recoveryRatePer100k">Recovered / 100k</option>
                    <option value="infectionRatePercent">Infected (%)</option>
                    <option value="recoveryRatePercent">Recovery rate (%)</option>
                    <option value="mortalityRatePercent">Mortality rate (%)</option>
                  </optgroup>
                  <optgroup label="Period change">
                    <option value="newCasesSum">New cases</option>
                    <option value="newDeathsSum">New deaths</option>
                    <option value="newRecoveredSum">New recovered</option>
                  </optgroup>
                  <optgroup label="Cumulative totals (period end)">
                    <option value="totalCasesEnd">Cases</option>
                    <option value="totalDeathsEnd">Deaths</option>
                    <option value="totalRecoveredEnd">Recovered</option>
                  </optgroup>
                  <optgroup label="Vaccination">
                    <option
                      value="vaccinationRatePercent"
                      disabled={!supportsVaccination}
                    >
                      Vaccinated (%) {!supportsVaccination ? "(unavailable)" : ""}
                    </option>
                  </optgroup>
                </select>
              </label>
            </div>
            <MetricsChart
              countries={data.countries}
              metric={chartMetric}
              selected={selectedSet}
            />
            </section>
          )}

          {activeView === "table" && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">Table</h2>
              <MetricsTable
                countries={data.countries}
                selected={selectedSet}
                onToggleCountry={toggleCountry}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
