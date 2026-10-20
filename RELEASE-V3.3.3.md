# Trading Signal v3.3.3

## Reliability hotfix

- Retries transient Telegram transport failures (`ETIMEDOUT`, `ECONNRESET`, `EAI_AGAIN`, connect/socket timeouts) before a scheduled batch is marked failed.
- Adds a bounded Telegram request timeout and configurable retry/backoff settings.
- Scheduled batch Telegram failures now log structured `cause` details for PM2 diagnostics.
- Preserves per-group isolation: a Stock failure does not discard successful Crypto/Metals reports before the final batch send.
- Carries forward the v3.3.2 Stock D1 stage/error-state fix so Stock cannot remain stuck in `RUNNING` after an exception.
- Carries forward Bar Replay FINAL R2 from v3.3.2.

No database migration and no dependency changes are required.
