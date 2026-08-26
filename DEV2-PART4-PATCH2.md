# Trading Signal v3.3.0-dev.4 — DEV 2 / Part 4 Patch 2

## Fixes
- Styled the Stock scanner scope dropdown to match the adjacent toolbar buttons.
- Confirmed scanner behavior: VN30, HOSE, HNX, and UPCOM scan only symbols already prepared in PostgreSQL.
- Scanning never triggers add/backfill. Missing symbols must be added explicitly with `Thêm mã + backfill`.

## Expected behavior
- `VN30 (4/30 sẵn sàng)` + Quét D1 => scans exactly 4 prepared symbols.
- No new instrument is created and no historical backfill starts.
- After manually adding/backfilling another VN30 symbol, the readiness count increases on reload.
