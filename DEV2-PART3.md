# Trading Signal v3.3.0-dev.3 — DEV 2 / Part 3

## Dynamic Stock Universe
The VN Stock tab no longer depends on a five-symbol hard-coded universe.

### Added
- Input `Mã mới` + `Thêm mã + backfill`.
- Trading Signal proxies add/remove requests to Stocks Data Collector.
- New symbol is auto-resolved and backfilled by the collector.
- `Xóa` deactivates a symbol and automatically removes it from Trading Signal stock watchlist.
- Historical PostgreSQL candles are preserved when a symbol is removed.
- Stock symbols/sidebar/overview/watchlist now follow the collector's active DB list.
- Add/backfill request timeout is 5 minutes because Community backfill is intentionally throttled.

### Windows local acceptance
1. Run `stocks-data-collector v0.2.0-dev.2` on `:8790` with PostgreSQL and SSI credentials.
2. Run Trading Signal:

```powershell
npm.cmd install
$env:STOCKS_API_URL="http://127.0.0.1:8790/"
npm.cmd start
```

3. Open `http://127.0.0.1:3210/#stocks`.
4. Add `VCB`.
5. Wait for the 3-year smart backfill to finish.
6. Confirm VCB appears with correct exchange/name/price and D1 chart opens.
7. Add VCB to watchlist, save, reload, and scan D1.
8. Click `Xóa` for VCB; confirm it disappears from the table/watchlist.
9. Re-add VCB; it should return quickly because historical candles were preserved.

## Internal validation
- `npm test`: 142/142 PASS
- `npm run check`: PASS
