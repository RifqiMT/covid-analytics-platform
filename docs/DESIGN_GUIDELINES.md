# Design Guidelines

## Visual goals
- Professional, calm, readable UI for dense analytics
- Strong focus on clarity: labels, units, and provenance
- Avoid UI noise and redundant controls

## Design tokens (Tailwind)
Defined in `tailwind.config.ts`:

### Surface palette
- `surface.DEFAULT`: `#ffffff`
- `surface.card`: `#fff7ed` (warm card background)
- `surface.muted`: `#f1f5f9` (borders/neutral backgrounds)
- `surface.input`: `#ffffff`

### Accent palette (Indonesia-inspired)
- `accent.DEFAULT`: `#dc2626`
- `accent.dim`: `#b91c1c`
- `accent.strong`: `#991b1b`
- `accent.gold`: `#d4af37`
- `accent.goldDim`: `#b88a1e`

### Indonesia tokens
- `indonesia.red`: `#dc2626`
- `indonesia.white`: `#ffffff`
- `indonesia.gold`: `#d4af37`
- `indonesia.goldDim`: `#b88a1e`
- `indonesia.ink`: `#111827`

## Typography
- `Inter` (UI)
- `JetBrains Mono` (code snippets / numeric alignment where needed)

## Components & patterns
### Layout
- Full-width app container with responsive padding (`px-4 md:px-6 lg:px-8`)
- Sticky top bar for view switching (Charts / Map / Table)

### Buttons
- Primary: accent background (`bg-accent`)
- Secondary: white background + border
- Use split-button pattern for “Refresh / Force” actions to reduce redundancy

### Data formatting
- Use `formatNumber` and `formatPercent` (`src/lib/format.ts`) consistently
- Always include units in labels (e.g., “Cases / 100k”, “Mortality rate (%)”)

### Charts
- Tooltip sorted by value descending
- Show “change vs previous period” in tooltip

### Map
- Prefer Canvas for many markers
- Cap markers in all-countries mode and explain cap in UI

