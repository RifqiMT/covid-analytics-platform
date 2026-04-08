# Changelog

All notable changes to this project should be documented in this file.

## 2026-04-08
### Added / Improved
- **Stability**: Upgraded to **Next.js 16.2.2** with aligned tooling (ESLint 9, Vitest 4) and resolved npm audit vulnerabilities.
- **Dev reliability**: Added `not-found.tsx`, hydration warning suppression at root, and stabilized the server/client boundary via `DashboardShell`.
- **Data integrity**:
  - Fixed recovered “future seeding” issue.
  - Enforced monotonic cumulative totals (cases/deaths/recovered/vaccination).
  - Added guardrails for percent rate metrics (avoid misleading early spikes).
- **Performance**:
  - Added best-effort **disk cache** for the OWID source to avoid repeated downloads/parses on dev restarts.
  - Added `/api/covid?preset=top15` for charts when “All countries” is selected.
  - Map: Canvas rendering + marker caps in all-countries mode.
- **UX**:
  - Simplified metrics naming (removed redundant “(cumulative)” series where applicable).
  - Chart tooltip sorted by value descending.
  - Table rows-per-page supports **All**.
  - Refresh controls refactored into a split-button (Refresh / Force).
  - Full-width layout (removed dead side spaces).

