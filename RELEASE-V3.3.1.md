# Trading Signal v3.3.1

Maintenance patch for VN Stock bulk prepare/backfill integration.

## Fixed

- Stock bulk prepare no longer treats an active symbol as automatically prepared.
- Every requested symbol is delegated to Stocks Data Collector Smart Backfill.
- Fully covered symbols are skipped by the collector with no provider data fetch.
- Active symbols with empty/incomplete candle history are backfilled again automatically.
- Batch result distinguishes: newly added, already prepared, backfilled again, and failed.
- Keeps legacy `skipped` response alias for v3.3.0 UI/API compatibility.

## Requires

- `stocks-data-collector >= 0.2.1` recommended for retry/deactivation semantics.
