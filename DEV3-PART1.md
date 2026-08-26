# Trading Signal v3.3.0-dev.5 — DEV 3 / Part 1

## Scope
VN Stock Automation D1 + Telegram foundation and Stock `.txt` import.

## Completed
- Stock list `.txt` import in the VN Stock tab.
- Automation schema v8.
- Stock automation scopes:
  - WATCHLIST
  - VN30
  - HOSE
  - HNX
  - UPCOM
- Stock Daily schedule, default `15:30` Asia/Ho_Chi_Minh.
- Manual `Chạy Stock D1`.
- Daily Sync runs before Stock scanner.
- Scanner only reads symbols already prepared in PostgreSQL.
- Telegram report reuses the unified Trading Signal signal/dedup/report engine.
- Scheduled Stock report participates in the existing one-message batch behavior.
- Scheduled Stock runs only Monday–Friday.
- If Daily Sync finds no new D1 candle (holiday/no session), scheduled Stock scan is skipped and no Telegram is sent.
- Manual Stock run remains available at any time.
- Stock price in Telegram is formatted as `nghìn ₫`.
- Stock watchlist remains managed from the VN Stock tab and is not accidentally cleared from the Automation tab.

## Windows local test
Keep Stocks Data Collector running on `127.0.0.1:8790`, then run Trading Signal:

```powershell
npm.cmd install
$env:STOCKS_API_URL="http://127.0.0.1:8790/"
npm.cmd start
```

### A. TXT import
1. Open `Chứng khoán Việt Nam`.
2. Click `Nạp .txt`.
3. Select a `.txt` containing stock symbols separated by spaces, commas, semicolons or new lines.
4. Confirm the parsed list appears in the textarea.
5. Confirm no backfill starts until `Thêm danh sách + backfill` is clicked.

### B. Stock Automation configuration
1. Open `Tự động & Telegram`.
2. Enable `STOCK · SSI`.
3. Select one or more scopes.
4. Enable `Stock D1`; default time should be `15:30`.
5. Save configuration.

### C. Manual Telegram test
Click `Chạy Stock D1`.

Expected flow:

```text
Daily Sync via Stocks Data Collector
→ PostgreSQL
→ scan prepared D1 candles
→ Signal engine
→ Telegram
```

Expected UI summary includes synced count, scanned count, signals sent and errors.

### D. Scheduler behavior
- Stock D1 is due only Monday–Friday at the configured time.
- Daily Sync is always run first.
- If there is no new D1 candle (holiday/no trading session), scheduler skips the Stock scan and sends no Telegram.
- If there is a fresh candle, Stock results join any other jobs at the same slot in the existing single Telegram batch.

## Validation
- `npm test`: 147/147 PASS
- `npm run check`: PASS
