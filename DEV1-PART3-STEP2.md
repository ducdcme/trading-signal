# Trading Signal v3.3.0-dev.1 — DEV 1 / Part 3 / Step 2

## Scope
VN Stock UI + D1 chart integration.

Still excluded:
- Stock scanner automation
- Scheduler
- Telegram
- W1 stock chart

## Added
- Real VN Stock panel replacing the placeholder.
- `GET /api/stocks/overview`
- Table columns: symbol, exchange, name, D1 close, D1 change, latest candle date, chart.
- Stock chart mode: `mode=STOCK`
- Stock chart endpoint: `/api/chart/stocks`
- Stock chart sidebar uses the 5 collector symbols.
- Existing EMA / Signal / SMC chart engine is reused.
- Stock chart is D1-only in this step.
- Prices are labelled as `nghìn VND`, matching the current Vnstock raw OHLC scale.

## Windows local test
Run Stocks Data Collector first:

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
http://127.0.0.1:3210/
```

Test:
1. Open `Chứng khoán Việt Nam`.
2. Confirm FPT, HPG, MBB, DGC, VIX are displayed.
3. Confirm close price, D1 percentage and latest candle date appear.
4. Click `Mở D1` for FPT.
5. Confirm chart loads and shows EMA / Signal / SMC controls.
6. Confirm Stock chart sidebar lists all 5 stock symbols.
7. Click HPG/MBB/DGC/VIX in the sidebar and confirm chart switches symbol.
8. Back returns to `#stocks`.

## Internal validation
- `npm test`: 139/139 PASS
- `npm run check`: PASS
