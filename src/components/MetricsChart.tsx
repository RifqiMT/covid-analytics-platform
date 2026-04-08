"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CountrySeriesPayload } from "@/lib/types/covid";
import { formatNumber, formatPercent } from "@/lib/format";

type MetricKey =
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

const PALETTE = [
  "#dc2626", // Indonesia red
  "#d4af37", // gold
  "#991b1b", // dark red
  "#b88a1e", // dark gold
  "#0f172a", // near-black
  "#475569", // slate
  "#7c2d12", // warm dark
  "#9a3412", // warm
];

export interface MetricsChartProps {
  countries: CountrySeriesPayload[];
  metric: MetricKey;
  selected: Set<string>;
}

function metricValueForBucket(
  b: CountrySeriesPayload["buckets"][number],
  metric: MetricKey,
): number | null {
  switch (metric) {
    case "newCasesSum":
      return b.newCasesSum;
    case "newDeathsSum":
      return b.newDeathsSum;
    case "newRecoveredSum":
      return b.newRecoveredSum;
    case "totalCasesEnd":
      return b.totalCasesEnd;
    case "totalDeathsEnd":
      return b.totalDeathsEnd;
    case "totalRecoveredEnd":
      return b.totalRecoveredEnd;
    case "infectionRatePer100k":
      return b.infectionRatePer100k;
    case "infectionRatePercent":
      return b.infectionRatePercent;
    case "deathRatePer100k":
      return b.deathRatePer100k;
    case "recoveryRatePer100k":
      return b.recoveryRatePer100k;
    case "recoveryRatePercent":
      return b.recoveryRatePercent;
    case "mortalityRatePercent":
      return b.mortalityRatePercent;
    case "vaccinationRatePercent":
      return b.vaccinationRatePercent;
    default:
      return null;
  }
}

function metricLabel(m: MetricKey): string {
  switch (m) {
    case "newCasesSum":
      return "New cases";
    case "newDeathsSum":
      return "New deaths";
    case "newRecoveredSum":
      return "New recovered";
    case "totalCasesEnd":
      return "Cases";
    case "totalDeathsEnd":
      return "Deaths";
    case "totalRecoveredEnd":
      return "Recovered";
    case "infectionRatePer100k":
      return "Cases / 100k";
    case "infectionRatePercent":
      return "Infected (%)";
    case "deathRatePer100k":
      return "Deaths / 100k";
    case "recoveryRatePer100k":
      return "Recovered / 100k";
    case "recoveryRatePercent":
      return "Recovery rate (%)";
    case "mortalityRatePercent":
      return "Mortality rate (%)";
    case "vaccinationRatePercent":
      return "Vaccinated (%)";
    default:
      return m;
  }
}

export function MetricsChart({
  countries,
  metric,
  selected,
}: MetricsChartProps) {
  const active = useMemo(() => {
    let list = countries.filter(
      (c) => selected.size === 0 || selected.has(c.profile.isoAlpha3),
    );
    if (selected.size === 0 && list.length > 15) {
      // When not explicitly focused, show the top series by the currently selected metric.
      // This avoids the confusing "alphabetical first 15" behavior where higher-valued
      // countries are not visible in the chart.
      list = [...list]
        .map((c) => {
          const last = c.buckets[c.buckets.length - 1];
          const v = last ? metricValueForBucket(last, metric) : null;
          return { c, v };
        })
        .sort((a, b) => {
          const av = typeof a.v === "number" && Number.isFinite(a.v) ? a.v : -Infinity;
          const bv = typeof b.v === "number" && Number.isFinite(b.v) ? b.v : -Infinity;
          const dv = bv - av;
          if (dv !== 0) return dv;
          return a.c.profile.countryName.localeCompare(b.c.profile.countryName);
        })
        .slice(0, 15)
        .map((x) => x.c);
    }
    return list;
  }, [countries, metric, selected]);

  const { rows, keys } = useMemo(() => {
    const byPeriod = new Map<
      string,
      Record<string, string | number | null>
    >();
    const keysInner: string[] = [];
    for (const c of active) {
      const key = c.profile.countryName;
      keysInner.push(key);
      for (const b of c.buckets) {
        const pKey = b.periodStart;
        const row = byPeriod.get(pKey) ?? { period: b.periodLabel, periodKey: pKey };
        let y: number | null = null;
        switch (metric) {
          case "newCasesSum":
            y = b.newCasesSum;
            break;
          case "newDeathsSum":
            y = b.newDeathsSum;
            break;
          case "newRecoveredSum":
            y = b.newRecoveredSum;
            break;
          case "totalCasesEnd":
            y = b.totalCasesEnd;
            break;
          case "totalDeathsEnd":
            y = b.totalDeathsEnd;
            break;
          case "totalRecoveredEnd":
            y = b.totalRecoveredEnd;
            break;
          case "infectionRatePer100k":
            y = b.infectionRatePer100k;
            break;
          case "infectionRatePercent":
            y = b.infectionRatePercent;
            break;
          case "deathRatePer100k":
            y = b.deathRatePer100k;
            break;
          case "recoveryRatePer100k":
            y = b.recoveryRatePer100k;
            break;
          case "recoveryRatePercent":
            y = b.recoveryRatePercent;
            break;
          case "mortalityRatePercent":
            y = b.mortalityRatePercent;
            break;
          case "vaccinationRatePercent":
            y = b.vaccinationRatePercent;
            break;
          default:
            y = null;
        }
        row[key] = y;
        byPeriod.set(pKey, row);
      }
    }
    const rowsInner = Array.from(byPeriod.values()).sort((a, b) =>
      String(a.periodKey).localeCompare(String(b.periodKey)),
    );

    // Add previous-period values per series for tooltip growth calculations.
    // Stored as `${seriesName}__prev` to avoid colliding with actual data keys.
    for (let i = 0; i < rowsInner.length; i++) {
      const prev = i > 0 ? (rowsInner[i - 1] as Record<string, unknown>) : null;
      const cur = rowsInner[i] as Record<string, unknown>;
      for (const k of keysInner) {
        const prevVal = prev ? (prev[k] as unknown) : null;
        cur[`${k}__prev`] = typeof prevVal === "number" ? prevVal : null;
      }
    }
    return { rows: rowsInner, keys: keysInner };
  }, [active, metric]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-surface-muted bg-surface-card p-6 text-sm text-slate-500">
        No rows for the current filters.
      </div>
    );
  }

  const formatter = (v: unknown): string => {
    if (typeof v !== "number") return "—";
    if (
      metric === "vaccinationRatePercent" ||
      metric === "infectionRatePercent" ||
      metric === "recoveryRatePercent" ||
      metric === "mortalityRatePercent"
    ) {
      return formatPercent(v);
    }
    return formatNumber(v);
  };

  const TooltipContent = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{
      name?: string;
      value?: unknown;
      color?: string;
      payload?: Record<string, unknown>;
    }>;
    label?: string;
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    const rows = payload
      .filter((p) => typeof p.value === "number" && Number.isFinite(p.value as number))
      .sort((a, b) => {
        const dv = Number(b.value) - Number(a.value);
        if (dv !== 0) return dv;
        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      });

    const formatGrowth = (cur: number, prev: number | null): string | null => {
      if (prev == null || !Number.isFinite(prev)) return null;
      // Avoid misleading "infinite" growth; show N/A when prev is 0.
      if (prev === 0) return null;
      const pct = ((cur - prev) / Math.abs(prev)) * 100;
      const sign = pct > 0 ? "+" : "";
      return `${sign}${pct.toFixed(2)}%`;
    };

    const formatBps = (cur: number, prev: number | null): string | null => {
      if (prev == null || !Number.isFinite(prev)) return null;
      const bps = (cur - prev) * 100; // 1% point = 100 bps
      const sign = bps > 0 ? "+" : "";
      return `${sign}${Math.round(bps)} bps`;
    };

    return (
      <div className="min-w-[220px] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-xs font-semibold text-slate-900">{label}</div>
          <div className="text-[11px] text-slate-500">{metricLabel(metric)}</div>
        </div>
        <div className="mt-2 space-y-1">
          {rows.slice(0, 12).map((p) => (
            <div key={String(p.name)} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: p.color ?? "#111827" }}
                />
                <span className="truncate text-xs text-slate-700">{p.name}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold tabular-nums text-slate-900">
                  {formatter(p.value)}
                </span>
                {(() => {
                  const name = String(p.name ?? "");
                  const cur = Number(p.value);
                  const prevRaw =
                    p.payload && name ? (p.payload[`${name}__prev`] as unknown) : null;
                  const prev = typeof prevRaw === "number" ? prevRaw : null;
                  if (prev == null) return null;

                  const growth =
                    metric === "vaccinationRatePercent" ||
                    metric === "infectionRatePercent" ||
                    metric === "recoveryRatePercent" ||
                    metric === "mortalityRatePercent"
                      ? formatBps(cur, prev)
                      : formatGrowth(cur, prev);
                  if (!growth) return null;
                  const isUp =
                    metric === "vaccinationRatePercent"
                      ? cur - prev > 0
                      : cur - prev > 0;
                  return (
                    <span
                      className={[
                        "text-[11px] tabular-nums",
                        isUp ? "text-emerald-700" : "text-rose-700",
                      ].join(" ")}
                      title="Change vs previous period"
                    >
                      ({growth})
                    </span>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
        {rows.length > 12 && (
          <div className="mt-2 text-[11px] text-slate-500">
            + {rows.length - 12} more
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-[420px] w-full rounded-lg border border-surface-muted bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fill: "#475569", fontSize: 11 }} />
          <YAxis
            tick={{ fill: "#475569", fontSize: 11 }}
            tickFormatter={(v) => formatter(v)}
          />
          <Tooltip
            content={<TooltipContent />}
          />
          <Legend />
          {keys.map((k, i) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={PALETTE[i % PALETTE.length]}
              dot={false}
              strokeWidth={2}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-xs text-slate-500">
        {metricLabel(metric)} · period on x-axis
        {selected.size === 0 && countries.length > 15 && (
          <span> · showing top 15 countries by value — narrow selection to compare more</span>
        )}
      </p>
    </div>
  );
}
