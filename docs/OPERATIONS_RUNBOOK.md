# Operations Runbook

## Local development
### Start (clean)

```bash
npm run dev:clean
```

### Test

```bash
npm test
```

### Typecheck (strict)

```bash
npm run typecheck:strict
```

### Build

```bash
npm run build
```

## Troubleshooting
### Slow first load
The dataset is large. First call may take up to ~2 minutes when caches are cold. Subsequent calls should be much faster due to source caching.

### Upstream fetch failures
- Check network/VPN/firewall.
- Use **Force** refresh to bypass caches if you suspect stale data.
- Disk cache may allow operation even when upstream is temporarily unavailable.

### Dev overlays and how we mitigate them
- Hydration mismatch: often caused by browser extensions injecting attributes; root suppresses hydration warnings.
- Leaflet “map container initialized”: mitigated via lifecycle cleanup and dev configuration; Map uses Canvas and remount keying.

## Environments (conceptual)
- **Dev**: in-memory caches + best-effort disk cache.
- **Production**: caches are per-instance (serverless). Consider adding an external cache if required.

