# User Persona — Engineer / Maintainer

## Summary
- **Name**: Engineer “Rafi”
- **Goal**: Maintain a stable, performant analytics dashboard and extend metrics over time.
- **Primary workflows**: Improve caching, fix data integrity issues, tune UI performance.

## Context
- Works with TypeScript/Next.js stacks
- Needs predictable architecture and clear boundaries between fetch, transform, and render

## Pain points
- Large upstream payloads; flaky network errors
- Dev-server chunk/HMR issues in large apps
- Leaflet lifecycle issues during hot reload

## Needs & expectations
- Clear service-layer architecture
- Guardrails docs and traceability matrix
- Repeatable local runbook

## Acceptance criteria
- One-command clean restart (`npm run dev:clean`)
- Build + tests pass with clear docs
- Variables, formulas, and derived metrics are documented

