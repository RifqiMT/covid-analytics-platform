# User Persona — Public Health Researcher

## Summary
- **Name**: Researcher “Dr. Sam”
- **Goal**: Validate trend shapes and derived rates (infection %, mortality %, recovery %) across time.
- **Primary workflows**: Adjust date ranges, inspect buckets, sanity-check rates and anomalies.

## Context
- Strong domain knowledge; expects mathematically consistent metrics
- Sensitive to misleading spikes from small denominators

## Pain points
- Upstream revisions can change history
- Early-period rates can be misleading without guardrails

## Needs & expectations
- Guardrails for rates and clear null behavior
- Confidence that cumulative metrics are monotonic (no backward jumps)
- Provenance and source attribution

## Acceptance criteria
- Rates avoid unrealistic early-period spikes (use guardrails)
- Recovered series does not teleport from future values
- Notes indicate clamping/mirroring logic

