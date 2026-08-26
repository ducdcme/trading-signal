# Trading Signal v3.3.0-dev.2 — DEV 2 / Part 1

## Scope
VN Stock Watchlist + manual D1 scanner.

Not enabled yet:
- Stock scheduler
- Stock Telegram delivery
- Stock W1 scanner

## Added
- Version: `3.3.0-dev.2`
- Persistent VN Stock watchlist stored in the existing automation settings file.
- `GET /api/stocks/watchlist`
- `PUT /api/stocks/watchlist`
- `POST /api/scan/stocks`
- Stock table checkboxes for watchlist selection.
- `Lưu watchlist` button.
- `Quét D1` button.
- D1 scan result summary and per-symbol signal columns.
- Scanner reuses the existing Pine-compatible signal engine:
  - BUY
  - SELL
  - BOTH
  - NONE
  - Exit Short => BUY
  - Exit Long => SELL
- Stock D1 candle close time is normalized to 15:15 Asia/Ho_Chi_Minh so the current trading day's closed candle is eligible after market close.
- Stock provider metadata changed from legacy placeholder `SSI` to `VNSTOCK`.

## Windows local test

Run Stocks Data Collector:

```powershell
$env:STOCKS_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/stocks_data"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8790
```

Run Trading Signal:

```powershell
npm.cmd install
$env:STOCKS_API_URL="http://127.0.0.1:8790/"
npm.cmd start
```

Open:

```text
http://127.0.0.1:3210/#stocks
```

### Acceptance test
1. Select FPT, HPG, MBB, DGC, VIX or a subset.
2. Click `Lưu watchlist`.
3. Reload the page and confirm selected symbols remain checked.
4. Click `Quét D1`.
5. Confirm summary cards show BUY / SELL / BOTH / NONE as applicable.
6. Confirm every selected stock has:
   - signal status
   - signal detail
   - latest close
   - latest D1 candle date
7. Open a stock chart and confirm D1 chart still works.
8. Uncheck one symbol, save, reload, and confirm it stays removed.

Optional API checks:

```powershell
curl.exe http://127.0.0.1:3210/api/stocks/watchlist

curl.exe -X POST `
  -H "Content-Type: application/json" `
  -d '{"symbols":["FPT","HPG","MBB","DGC","VIX"]}' `
  http://127.0.0.1:3210/api/scan/stocks
```

## Internal validation
- `npm test`: 140/140 PASS
- `npm run check`: PASS
