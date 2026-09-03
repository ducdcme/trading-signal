# Bar Replay DEV.1

Baseline: Trading Signal v3.3.1.

## Scope
- Adds Bar Replay controls to the existing chart only.
- Does not merge or depend on any backtest code.
- User clicks `Bar Replay`, then clicks a visible historical candle to set the replay cutoff.
- Future candles are hidden.
- `◀` / `▶` and keyboard Left/Right step one candle at a time.
- `Thoát Replay` restores the full chart.
- SMC layers are rebuilt from candles available at the replay cursor, preventing future-structure leakage.
- Crosshair also uses only the replay-visible candle history.

## Validation
- `npm test`: 156/156 passing.
- `npm run check`: passing.
