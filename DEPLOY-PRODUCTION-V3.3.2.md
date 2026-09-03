# Deploy Trading Signal v3.3.2

## Scope

Code-only release. No database migration, no `.env` schema change, and no dependency change from v3.3.1.

Recommended companion: `stocks-data-collector >= 0.2.8`.

## VPS deployment (PM2)

```bash
cd /opt/trading-signal

git status
git fetch --tags
git checkout v3.3.2

npm ci
npm test
npm run check

pm2 restart trading-signal
pm2 status
pm2 logs trading-signal --lines 100 --nostream
```

If the PM2 process has a different name, substitute that name in the last three commands.

## Smoke checks

- Open Chart and verify Bar Replay controls, Long/Short position objects, hover layout, SMC Order Blocks and replay exit arrows.
- Run Stock D1 manually and verify the run finishes at `OK` when successful.
- On a forced Stock D1 failure, verify the state changes from `RUNNING` to `ERROR` and PM2 logs include the failing `stage`.
