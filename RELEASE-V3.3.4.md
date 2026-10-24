# Trading Signal v3.3.4 — Telegram Delivery Reliability Patch

## Scope
Small reliability patch before Modular Foundation. No market-scan logic, signal logic, chart logic, or scheduler timing changes.

## Changes
- Scheduled batch Telegram sends use a single immediate attempt; transient transport failures are persisted instead of retried back-to-back.
- Persist the fully rendered batch message in `automation-state.json`; retries never rerun scans or recalculate signals.
- Default delayed retry schedule: 5 minutes, then 10 minutes for subsequent attempts (`TELEGRAM_QUEUE_RETRY_MINUTES=5,10,10,10,10,10`).
- Queue only transient transport/network failures such as `ETIMEDOUT`, `ECONNRESET`, `EAI_AGAIN`, `ENETUNREACH`, connect/socket timeout.
- Telegram API/configuration errors remain permanent failures and are not queued.
- Successful delayed delivery merges the batch `sentKeys` and marks the batch slot `sent-retry`.
- Retry exhaustion is logged explicitly; the scan slot remains consumed throughout, preventing duplicate scans/signals.

## Compatibility
- No database migration.
- No required `.env` change; the retry schedule has safe defaults.
- Existing manual Telegram delivery behavior is unchanged.
