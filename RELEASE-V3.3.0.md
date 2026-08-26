# Trading Signal v3.3.0 — Release

## Theme
**Chứng khoán Việt Nam**

## Final architecture

```text
SSI FastConnect (primary) ─┐
                           ├─> stocks-data-collector :8790 ─> PostgreSQL stocks_data
Vnstock Community (fallback)┘                                  │
                                                               v
Trading Signal :3210 <──────────────────────────────────────────┘
```

Trading Signal reads VN Stock candles from PostgreSQL through the local Stocks Data Collector. It does not call SSI directly.

## Delivered in v3.3.0
- VN Stock D1 chart using the existing EMA / Signal / SMC engine.
- SSI primary provider; Vnstock Community fallback.
- PostgreSQL historical storage, smart backfill and daily sync.
- Dynamic stock universe and multi-symbol / `.txt` preparation.
- Watchlist + VN30 / HOSE / HNX / UPCOM scanner scopes.
- Scanner is DB-only: scanning never silently starts a backfill.
- Stock Automation and Telegram.
- Auto Stock D1 default schedule: **07:00 Asia/Ho_Chi_Minh**.
- Manual and automatic Stock scans both use the latest **closed D1 candle**.
- Telegram jobs in the same scheduler slot are merged into one report.
- Shared dedup state and restart-safe at-most-once scheduler batching.
- Stock runtime status and stock-list management are available in Automation UI.
- Stock tab defaults to Watchlist; prepared universe remains viewable.

## Final regression
- Trading Signal: **152 / 152 tests PASS**
- Trading Signal: `npm run check` PASS
- Stocks Data Collector: **40 / 40 tests PASS**
- Stocks Data Collector: Python `compileall` PASS

## Release versions
- Trading Signal: **3.3.0**
- Stocks Data Collector: **0.2.0**
