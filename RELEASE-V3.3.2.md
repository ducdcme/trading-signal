# Trading Signal v3.3.2

Release integrating the completed Bar Replay UI with the Stock D1 automation hardening tested on v3.3.1.

## Bar Replay

- Finalize Long/Short position objects and hover behavior with mirrored SL/TP layout.
- Center position text on the object and remove the entry-value text from the position label.
- Keep replay drawings on the chart until manually removed instead of clearing them automatically.
- Keep pending entry objects at their future chart position when appropriate.
- Keep SMC Order Blocks enabled in the closed Replay UI state.
- Fix Long/Short exit evaluation so TP/SL can never be registered before the visual Entry bar.
- Prevent TP/SL exit arrows from pointing into the past, including Short objects placed or moved ahead of the replay cursor.

## Stock D1 automation

- Track the current Stock D1 stage (`resolve-symbols`, `daily-sync`, `scan`, `telegram`, state persistence) for diagnostics.
- Persist `ERROR` state when any Stock D1 stage fails instead of leaving the UI stuck at `RUNNING`.
- Log the failing stage and nested Node `fetch()` cause to server/PM2 logs.
- Refresh automation state in the UI after a failed manual Stock D1 run so the error state is shown immediately.
- Preserve the successful Stock D1 flow and Telegram delivery behavior tested on the v3.3.1 fix build.

## Compatibility

- No Trading Signal database migration.
- No `.env` format change.
- Recommended with `stocks-data-collector >= 0.2.8` for holiday-safe VN Stock metadata/universe handling.
