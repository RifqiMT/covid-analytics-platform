"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { CountrySeriesPayload } from "@/lib/types/covid";
import { formatNumber, formatPercent } from "@/lib/format";

export interface MetricsTableProps {
  countries: CountrySeriesPayload[];
  selected: Set<string>;
  onToggleCountry: (isoAlpha3: string) => void;
}

export function MetricsTable({
  countries,
  selected,
  onToggleCountry,
}: MetricsTableProps) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const visible =
    selected.size === 0
      ? countries
      : countries.filter((c) => selected.has(c.profile.isoAlpha3));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((c) => {
      const hay = `${c.profile.countryName} ${c.profile.isoAlpha3} ${c.profile.isoAlpha2 ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, visible]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, selected, countries]);

  const total = filtered.length;
  const effectivePageSize = pageSize === 0 ? Math.max(1, total) : pageSize;
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);

  const rows = useMemo(() => {
    const startIdx = (clampedPage - 1) * effectivePageSize;
    const slice =
      pageSize === 0 ? filtered : filtered.slice(startIdx, startIdx + effectivePageSize);
    return slice.map((c) => {
      const last = c.buckets[c.buckets.length - 1];
      return { c, last };
    });
  }, [clampedPage, effectivePageSize, filtered, pageSize]);

  return (
    <div className="rounded-lg border border-surface-muted bg-white">
      <div className="flex flex-col gap-3 border-b border-surface-muted p-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Search in table
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a country name or code…"
              className="mt-1 w-full rounded-lg border border-surface-muted bg-surface-input px-3 py-2 text-sm text-slate-900 shadow-sm md:w-[260px]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Rows per page
            </label>
            <select
              className="mt-1 rounded-lg border border-surface-muted bg-surface-input px-3 py-2 text-sm text-slate-900 shadow-sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={0}>All</option>
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-surface-card px-3 py-1 text-xs text-slate-700">
            Showing{" "}
            <span className="font-semibold text-slate-900">
              {total === 0 ? 0 : (clampedPage - 1) * effectivePageSize + 1}
            </span>
            {"–"}
            <span className="font-semibold text-slate-900">
              {Math.min(clampedPage * effectivePageSize, total)}
            </span>{" "}
            of <span className="font-semibold text-slate-900">{total}</span>
          </span>
          <div className="inline-flex overflow-hidden rounded-lg border border-surface-muted bg-white shadow-sm">
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-surface-card disabled:opacity-50"
              onClick={() => setPage(1)}
              disabled={clampedPage === 1}
            >
              First
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-surface-card disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={clampedPage === 1}
            >
              Prev
            </button>
            <span className="px-3 py-1.5 text-xs text-slate-600">
              Page <span className="font-semibold text-slate-900">{clampedPage}</span> /{" "}
              <span className="font-semibold text-slate-900">{totalPages}</span>
            </span>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-surface-card disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={clampedPage === totalPages}
            >
              Next
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-surface-card disabled:opacity-50"
              onClick={() => setPage(totalPages)}
              disabled={clampedPage === totalPages}
            >
              Last
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-surface-card text-left text-xs uppercase tracking-wide text-slate-700">
          <tr>
            <th className="px-3 py-3">Country</th>
            <th className="px-3 py-3">Code</th>
            <th className="px-3 py-3">Population</th>
            <th className="px-3 py-3">Period</th>
            <th className="px-3 py-3 text-right">Cases</th>
            <th className="px-3 py-3 text-right">Deaths</th>
            <th className="px-3 py-3 text-right">Recovered</th>
            <th className="px-3 py-3 text-right">Vaccinated</th>
            <th className="px-3 py-3 text-right">New cases</th>
            <th className="px-3 py-3 text-right">New deaths</th>
            <th className="px-3 py-3 text-right">New rec.</th>
            <th className="px-3 py-3 text-right">Cases/100k</th>
            <th className="px-3 py-3 text-right">Infected %</th>
            <th className="px-3 py-3 text-right">Deaths/100k</th>
            <th className="px-3 py-3 text-right">Rec./100k</th>
            <th className="px-3 py-3 text-right">Recovery %</th>
            <th className="px-3 py-3 text-right">Mortality %</th>
            <th className="px-3 py-3 text-right">Vacc. %</th>
            <th className="px-3 py-3">Focus</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-surface">
          {rows.map(({ c, last }) => (
            <tr key={c.profile.isoAlpha3} className="hover:bg-surface-card/60">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  {c.profile.flagUrl && (
                    <Image
                      src={c.profile.flagUrl}
                      alt=""
                      width={28}
                      height={18}
                      className="rounded-sm border border-slate-200"
                      unoptimized
                    />
                  )}
                  <span className="font-medium text-slate-900">
                    {c.profile.countryName}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-slate-600">
                {c.profile.isoAlpha3}
                {c.profile.isoAlpha2
                  ? ` / ${c.profile.isoAlpha2}`
                  : ""}
              </td>
              <td className="px-3 py-2 text-slate-700">
                {formatNumber(last?.populationEnd)}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {last ? last.periodLabel : "—"}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatNumber(last?.totalCasesEnd)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatNumber(last?.totalDeathsEnd)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatNumber(last?.totalRecoveredEnd)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatNumber(last?.peopleVaccinatedEnd)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatNumber(last?.newCasesSum)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatNumber(last?.newDeathsSum)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatNumber(last?.newRecoveredSum)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatNumber(last?.infectionRatePer100k)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatPercent(last?.infectionRatePercent)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatNumber(last?.deathRatePer100k)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatNumber(last?.recoveryRatePer100k)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatPercent(last?.recoveryRatePercent)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatPercent(last?.mortalityRatePercent)}
              </td>
              <td className="px-3 py-2 text-right text-slate-900">
                {formatPercent(last?.vaccinationRatePercent)}
              </td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="text-xs text-sky-400 hover:underline"
                  onClick={() => onToggleCountry(c.profile.isoAlpha3)}
                >
                  {selected.has(c.profile.isoAlpha3)
                    ? "Remove focus"
                    : "Add focus"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
