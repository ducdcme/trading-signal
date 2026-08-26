# Trading Signal v3.3.0-dev.4 — DEV 2 / Part 4 Final

## Final behavior

- Scanner scopes: Watchlist / VN30 / HOSE / HNX / UPCOM.
- All scans are database-only; scanning never adds or backfills symbols.
- Multi-symbol Add + Backfill accepts symbols separated by spaces, commas, semicolons, or newlines.
- Duplicate input symbols are removed automatically.
- Symbols already active in PostgreSQL are skipped automatically.
- Missing symbols are added/backfilled sequentially through Stocks Data Collector (SSI primary, Vnstock fallback).
- One failed symbol does not stop the rest of the batch.
- Input limit: 100 symbols per batch.

## Suggested VN30 one-time preparation

Paste the full VN30 symbol list into the input and click `Thêm danh sách + backfill`. After it completes, reload group readiness and scan VN30 from PostgreSQL.

## Acceptance test

1. Paste a list containing new symbols, an existing symbol, duplicates, commas and newlines.
2. Click Add + Backfill once.
3. Confirm the summary reports added / already existed / failed.
4. Confirm existing symbols were not backfilled again.
5. Confirm successful new symbols appear in the table and open D1 charts.
6. Select VN30 and scan D1; confirm it scans only `prepared` symbols and triggers no backfill.
7. Confirm Watchlist / HOSE / HNX / UPCOM behavior is unchanged.
