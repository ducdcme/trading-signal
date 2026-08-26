# Trading Signal v3.3.0-dev.1 — DEV 1 / Part 3 / Step 1

## Scope
Connect Trading Signal to the independent VN Stocks Data Collector.

This step intentionally does not enable Stock scanning, automation, scheduler, or Telegram.

## Added
- `lib/stocks.js`: Stocks Data Collector adapter.
- `STOCKS_API_URL` (default `http://127.0.0.1:8790/`).
- `GET /api/stocks/symbols`
- `GET /api/chart/stocks?symbol=FPT&timeframe=1D&limit=500`
- Stock chart payload reuses the existing EMA/Signal/SMC engine.
- `capabilities.stocks = true`.
- Version: `3.3.0-dev.1`.

## Windows local test
Run `stocks-data-collector` on port 8790 first.

Then:

```powershell
npm install
$env:STOCKS_API_URL="http://127.0.0.1:8790/"
npm start
```

Test:

```powershell
curl.exe http://127.0.0.1:3210/api/health
curl.exe http://127.0.0.1:3210/api/stocks/symbols
curl.exe "http://127.0.0.1:3210/api/chart/stocks?symbol=FPT&timeframe=1D&limit=500"
```

Expected:
- health version `3.3.0-dev.1`
- symbols include FPT, HPG, MBB, DGC, VIX
- chart has `market.assetType = STOCK`, `market.provider = database`

## Internal validation
- `npm test`: 138/138 PASS
- `npm run check`: PASS
