# Trading Signal v3.3.0-dev.9 — DEV 3 / Part 2 Patch 3

## Final UX patch before full regression

### Stock tab
- Default table view is `Watchlist`.
- Reload shows only symbols currently saved in the Stock watchlist.
- `Hiển thị → Tất cả mã đã chuẩn bị` exposes the complete active PostgreSQL universe when needed.
- Scanner scope remains independent from table display scope. VN30/HOSE/HNX/UPCOM continue to scan prepared DB symbols only.

### Telegram scheduled batch
- `Trading Signal` appears once in the global batch header.
- Section headings are compact: `COIN`, `VÀNG & BẠC`, `CHỨNG KHOÁN`, `DEX`, `COIN MỚI`.
- Signal/dedup/scheduler behavior is unchanged.

### Acceptance
1. Reload Stock tab: only saved watchlist rows appear.
2. Change `Hiển thị` to `Tất cả mã đã chuẩn bị`: all active PostgreSQL Stock rows appear.
3. Save/un-save watchlist and return to Watchlist view: table updates accordingly.
4. Trigger a scheduled batch with at least two asset groups: only one `Trading Signal` header appears.
