# Trading Signal v3.3.0-dev.8 — DEV 3 / Part 2 Patch 2

## Final Stock D1 workflow rule
- Auto and Manual Stock D1 use the same dataset rule: the latest **closed** D1 candle available in PostgreSQL.
- The only difference is the trigger: scheduler vs manual button.
- Default Stock D1 scheduler time is `07:00` Asia/Ho_Chi_Minh, intended to prepare for the coming trading session.
- Daily Sync still runs before every Stock scan, but a scheduled scan is **not skipped** merely because Sync fetched zero new candles. The latest closed D1 candle is still scanned.
- At 07:00 Monday, the latest closed candle may be Friday; that is valid and is scanned.
- Before the current trading day's D1 candle closes, scanner continues using the latest prior closed candle.
- After the current day's candle closes and Daily Sync stores it, the same Manual/Auto scanner naturally uses that newer closed candle.

## Schedule migration
- Automation schema is v11.
- Old default `15:30` is migrated to `07:00`.
- Explicit custom times (for example `10:32`) are preserved.

## Validation
- Run `npm test`
- Run `npm run check`
