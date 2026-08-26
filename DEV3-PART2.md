# Trading Signal v3.3.0-dev.6 — DEV 3 / Part 2

## Scope
Scheduler/Telegram batch hardening for VN Stock automation and all shared automation slots.

## Completed
- One shared dedup state across every job in the same scheduler slot.
- Scheduled batch state persisted in `automation-state.json` (`batchSlots`).
- At-most-once batch behavior across process restarts.
- The slot is consumed before Telegram delivery begins, so an uncertain/in-flight delivery is not replayed after restart.
- One failing group does not stop the remaining scheduled groups.
- Failed groups are represented in the common Telegram batch only by group name and error count; technical details stay in server logs.
- If a scheduled job intentionally has no report (e.g. Stock holiday/no fresh D1 candle), its slot is still completed and will not rerun on the next scheduler poll/restart.
- `sentKeys` are committed only for the common scheduled batch and shared immediately between jobs while the batch is being built.
- Automation schema/state version is now 9.

## Delivery semantics
The scheduler intentionally favors **no duplicate alerts** (`at-most-once`) over automatic replay after an uncertain Telegram send. If the process dies while a Telegram request is in flight, that slot is not resent after restart.

## Local acceptance test
### 1. Normal Stock schedule
Run the existing Stock D1 schedule and confirm Daily Sync -> DB scan -> Telegram still works.

### 2. Same-slot batch
Temporarily configure another D1 job (for example Metals Daily) to the same time as Stock D1. At the slot, expect one common Telegram report with both sections, not separate reports.

### 3. Restart/no duplicate
After the scheduled report arrives, restart Trading Signal within the same minute. The same slot must not send again.

### 4. Error isolation
For a local test, temporarily make one scheduled source unavailable while leaving another scheduled group healthy. The healthy group must still appear in the common report. Telegram may show `Lỗi nhóm tự động` with only a group/error count; it must not contain stack traces or raw technical error messages.

### 5. Stock holiday/no-new-candle
When Stock Daily Sync finds no fresh D1 candle, Stock produces no scheduled report and will not be rerun repeatedly in that slot. Other due groups continue normally.

## Validation
- `npm test`: 150/150 PASS
- `npm run check`: PASS
