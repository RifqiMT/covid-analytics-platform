"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
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

export interface CovidWorldMapProps {
  countries: CountrySeriesPayload[];
  metric: MetricKey;
  selected: Set<string>;
}

function pickMetric(
  bucket: CountrySeriesPayload["buckets"][number],
  m: MetricKey,
): number | null {
  switch (m) {
    case "newCasesSum":
      return bucket.newCasesSum;
    case "newDeathsSum":
      return bucket.newDeathsSum;
    case "newRecoveredSum":
      return bucket.newRecoveredSum;
    case "totalCasesEnd":
      return bucket.totalCasesEnd;
    case "totalDeathsEnd":
      return bucket.totalDeathsEnd;
    case "totalRecoveredEnd":
      return bucket.totalRecoveredEnd;
    case "infectionRatePer100k":
      return bucket.infectionRatePer100k;
    case "infectionRatePercent":
      return bucket.infectionRatePercent;
    case "deathRatePer100k":
      return bucket.deathRatePer100k;
    case "recoveryRatePer100k":
      return bucket.recoveryRatePer100k;
    case "recoveryRatePercent":
      return bucket.recoveryRatePercent;
    case "mortalityRatePercent":
      return bucket.mortalityRatePercent;
    case "vaccinationRatePercent":
      return bucket.vaccinationRatePercent;
    default:
      return null;
  }
}

function metricTitle(m: MetricKey): string {
  switch (m) {
    case "totalCasesEnd":
      return "Cases";
    case "totalDeathsEnd":
      return "Deaths";
    case "totalRecoveredEnd":
      return "Recovered";
    case "newCasesSum":
      return "New cases";
    case "newDeathsSum":
      return "New deaths";
    case "newRecoveredSum":
      return "New recovered";
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

function formatMetricValue(m: MetricKey, v: number | null): string {
  if (
    m === "vaccinationRatePercent" ||
    m === "infectionRatePercent" ||
    m === "recoveryRatePercent" ||
    m === "mortalityRatePercent"
  ) {
    return formatPercent(v);
  }
  return formatNumber(v);
}

export default function CovidWorldMap({
  countries,
  metric,
  selected,
}: CovidWorldMapProps) {
  const markerLimit = selected.size === 0 ? 350 : Number.POSITIVE_INFINITY;

  function MapLifecycle() {
    const map = useMap();
    useEffect(() => {
      return () => {
        try {
          map.remove();
        } catch {
          // ignore
        }
      };
    }, [map]);
    return null;
  }

  const points = useMemo(() => {
    const list: {
      code: string;
      name: string;
      lat: number;
      lng: number;
      value: number | null;
      flagUrl: string | null;
      population: number | null;
    }[] = [];

    const filtered =
      selected.size === 0
        ? countries
        : countries.filter((c) => selected.has(c.profile.isoAlpha3));

    for (const c of filtered) {
      const lat = c.profile.latitude;
      const lng = c.profile.longitude;
      if (lat == null || lng == null) continue;
      const last = c.buckets[c.buckets.length - 1];
      if (!last) continue;
      const value = pickMetric(last, metric);
      list.push({
        code: c.profile.isoAlpha3,
        name: c.profile.countryName,
        lat,
        lng,
        value,
        flagUrl: c.profile.flagUrl,
        population: c.profile.population,
      });
    }

    const totalCount = list.length;
    const limited =
      markerLimit === Number.POSITIVE_INFINITY
        ? list
        : [...list].sort((a, b) => {
            const av =
              a.value != null && Number.isFinite(a.value) ? Math.abs(a.value) : -1;
            const bv =
              b.value != null && Number.isFinite(b.value) ? Math.abs(b.value) : -1;
            const dv = bv - av;
            if (dv !== 0) return dv;
            return a.name.localeCompare(b.name);
          }).slice(0, markerLimit);

    const values = list
      .map((p) => p.value)
      .filter((v): v is number => v != null && Number.isFinite(v));
    const max = values.length ? Math.max(...values.map((v) => Math.abs(v))) : 0;

    return { list: limited, max, totalCount };
  }, [countries, markerLimit, metric, selected]);

  const colorFor = (v: number | null, max: number): string => {
    if (v == null || !Number.isFinite(v) || max <= 0) return "#64748b";
    const t = Math.min(1, Math.abs(v) / max);
    const hue = 220 - t * 220;
    return `hsl(${hue}, 85%, 55%)`;
  };

  return (
    <div className="overflow-hidden rounded-lg border border-surface-muted">
      <MapContainer
        key={`${metric}:${selected.size}:${countries.length}`}
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        className="h-[420px] w-full z-0"
        scrollWheelZoom
        preferCanvas
      >
        <MapLifecycle />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.list.length === 0 ? null : points.list.map((p) => {
          const radius =
            p.value != null && points.max > 0
              ? 6 + (Math.abs(p.value) / points.max) * 22
              : 6;
          return (
            <CircleMarker
              key={p.code}
              center={[p.lat, p.lng]}
              radius={radius}
              pathOptions={{
                color: "#0f1419",
                weight: 1,
                fillColor: colorFor(p.value, points.max),
                fillOpacity: 0.72,
              }}
            >
              <Popup>
                <div className="min-w-[200px] text-slate-900">
                  <div className="text-xs font-semibold">{p.name}</div>
                  <div className="mt-0.5 text-[11px] text-slate-600">{p.code}</div>
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                    <div className="text-[11px] text-slate-600">{metricTitle(metric)}</div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                      {formatMetricValue(metric, p.value)}
                    </div>
                    {p.population != null && (
                      <div className="mt-1 text-[11px] text-slate-600">
                        Population: {formatNumber(p.population)}
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <p className="bg-surface-card px-3 py-2 text-xs text-slate-600">
        Circle size and color encode {metricTitle(metric)} for the latest
        reporting bucket in your selected range.
        {points.totalCount > points.list.length ? (
          <>
            {" "}
            Showing top <span className="font-semibold">{points.list.length}</span>{" "}
            of <span className="font-semibold">{points.totalCount}</span> markers for
            performance (select countries to show all).
          </>
        ) : (
          <> Pan and zoom to explore.</>
        )}
      </p>
    </div>
  );
}
