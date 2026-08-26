# Trading Signal v3.3.0-dev.7 — DEV 3 / Part 2 Patch 1

## Fixes
- Automation tab now contains the Stock automation watchlist directly.
- Stock list supports `.txt` import in Automation.
- The Stock watchlist remains one shared source of truth with the VN Stock tab.
- Scheduled Stock runtime is visible without reloading: RUNNING / OK / SKIPPED / ERROR.
- Stock scheduler writes RUNNING before Daily Sync.
- SKIPPED explicitly shows `Không có nến D1 mới`. No Telegram is sent for this case.
- Automation runtime polls every 5 seconds, so background scheduler activity becomes visible.

## Why Stock was absent from the 10:32 batch
At 10:32 the VN market D1 candle for 26/08/2026 was not closed yet. Daily Sync therefore found no fresh candle and intentionally skipped Stock rather than scanning/sending the previous day's candle again.

## Validation target
- Stock D1 before 15:15: runtime should show SKIPPED and reason.
- Stock D1 after a fresh daily candle: runtime should show RUNNING then OK.
- Stock list can be typed or loaded from `.txt` directly in Automation.
