# Bar Replay DEV.2

Baseline: Trading Signal v3.3.1.

- Replay keeps the current zoom level and viewport instead of resetting the axes on enter/step/exit.
- TradingView-style candle colors: bullish #089981, bearish #F23645.
- Replay toolbar adds Long and Short position drawings.
- Position placement uses 3 clicks: Entry -> TP -> SL.
- Position drawings are anchored to chart bar/price coordinates, so they scale and move with zoom/pan.
- Position results update as replay advances: LIVE / WIN / LOSE; a bar touching both TP and SL is shown as TP/SL? because OHLC does not reveal intrabar order.
- Position drawings stay in memory when leaving Replay and disappear only when manually deleted or when chart data is loaded again/reloaded.
- Select a position by clicking inside it, then use Xoa vi the or Delete/Backspace.
- Backtest code remains separate.
