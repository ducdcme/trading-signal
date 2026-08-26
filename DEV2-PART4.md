# Trading Signal v3.3.0-dev.4 — DEV 2 / Part 4

## Expanded VN Stock scanner

Scanner scopes:
- Watchlist
- VN30
- HOSE
- HNX
- UPCOM

Each market group displays `prepared / total`.

Behavior:
- Watchlist scans checked symbols.
- Market groups scan only symbols already active in PostgreSQL.
- Selecting VN30/HOSE/HNX/UPCOM never starts backfill automatically.
- Missing symbols remain visible through readiness counts and can only be added/backfilled deliberately with the Add symbol action.

## New API
- `GET /api/stocks/groups`
- `POST /api/scan/stocks` with `scope`

## Local acceptance test
1. Start Stocks Data Collector using `.env`.
2. Start Trading Signal.
3. Open `#stocks`.
4. Confirm readiness counts, e.g. `VN30 (x/30 sẵn sàng)`.
5. Scan VN30, HOSE, HNX, UPCOM and verify only prepared symbols are scanned.
6. Switch back to Watchlist and verify checked-symbol scanning still works.
7. Add one missing stock, reload, and confirm its group prepared count increases.

## Validation
- `npm test`: 143/143 PASS
- `npm run check`: PASS
