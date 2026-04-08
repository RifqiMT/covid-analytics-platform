import countries from "world-countries";
import isoCountries from "i18n-iso-countries";
import type { CountryProfile } from "@/lib/types/covid";

export interface CountryMetadataResolverOptions {
  /** CDN pattern for flags; {code} is lowercase ISO alpha-2 */
  flagBaseUrl?: string;
}

/**
 * Resolves display metadata (ISO2, lat/lng, flag) from OWID ISO alpha-3 codes.
 */
export class CountryMetadataResolver {
  private readonly alpha3ToLatLng: Map<
    string,
    { lat: number; lng: number; alpha2: string }
  >;
  private readonly alpha3ToPopulation: Map<string, number>;

  private readonly flagBaseUrl: string;

  constructor(options: CountryMetadataResolverOptions = {}) {
    this.flagBaseUrl =
      options.flagBaseUrl ?? "https://flagcdn.com/w80/{code}.png";
    this.alpha3ToLatLng = new Map();
    this.alpha3ToPopulation = new Map();
    for (const c of countries) {
      if (!c.cca3) continue;
      const alpha3 = c.cca3.toUpperCase();
      const pop = (c as any).population;
      if (typeof pop === "number" && Number.isFinite(pop)) {
        this.alpha3ToPopulation.set(alpha3, pop);
      }
      if (c.cca2 && c.latlng && c.latlng.length >= 2) {
        this.alpha3ToLatLng.set(alpha3, {
          lat: c.latlng[0],
          lng: c.latlng[1],
          alpha2: c.cca2.toUpperCase(),
        });
      }
    }
  }

  resolveFromOwidRow(
    countryName: string,
    isoAlpha3: string,
    continent: string | null,
    latestPopulation: number | null,
    overrides?: { lat?: number | null; lng?: number | null },
  ): CountryProfile {
    const upper = isoAlpha3.toUpperCase();
    const geo = this.alpha3ToLatLng.get(upper) ?? null;
    const alpha2FromLib =
      isoCountries.alpha3ToAlpha2(upper) || geo?.alpha2 || undefined;
    const alpha2 = alpha2FromLib ? alpha2FromLib.toUpperCase() : null;
    const flagUrl = alpha2
      ? this.flagBaseUrl.replace("{code}", alpha2.toLowerCase())
      : null;

    return {
      countryName,
      isoAlpha3: upper,
      isoAlpha2: alpha2,
      continent,
      population: latestPopulation ?? this.alpha3ToPopulation.get(upper) ?? null,
      flagUrl,
      latitude: overrides?.lat ?? geo?.lat ?? null,
      longitude: overrides?.lng ?? geo?.lng ?? null,
    };
  }
}
