# Guardrails (Technical + Business)

## Business guardrails
- **Not medical advice**: This product is an analytics dashboard for trend exploration.
- **Source-of-truth limitations**: Values reflect upstream sources (OWID and mirror); do not treat as definitive official counts.
- **Reporting lag**: Recent dates may be incomplete; the UI communicates `dataThroughDate` and mirroring behavior.

## Data integrity guardrails
- **No future backfill into the past** for cumulative totals (prevents impossible historical ratios).
- **Monotonic cumulative enforcement**: cumulative totals must not decrease; decreases are treated as missing and carried forward.
- **Recovered enrichment is best-effort**: recovered is historically inconsistent across countries; mirror enrichment helps but does not guarantee completeness.

## Metric computation guardrails
- **Rate percentages** (`mortalityRatePercent`, `recoveryRatePercent`) return `null` when:
  - denominator is too small (noise)
  - numerator > denominator (logically inconsistent)
  - values are missing or non-finite
- **Percent clamping**: where applicable, values are constrained to valid ranges.

## Performance guardrails
- Avoid rendering/aggregating all-countries series when UI needs a small subset:
  - Charts use a `preset=top15` mode in all-countries scope.
  - Map caps markers in all-countries mode and uses Canvas rendering.
- Prefer caching at:
  - source fetch layer (memory + best-effort disk)
  - API response layer (short TTL + single-flight)

## Operational guardrails
- Use `npm run dev:clean` after config changes to avoid stale `.next` artifacts.
- Dev-only overlays:
  - Extension-injected DOM attributes can trigger hydration warnings; root suppresses hydration warnings.
  - Leaflet double-init is mitigated via lifecycle cleanup and dev config.

