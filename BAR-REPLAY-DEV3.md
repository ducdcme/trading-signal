# Bar Replay DEV.3

Baseline: Trading Signal v3.3.1. Backtest code remains separate.

## Position drawing interaction
- Long/Short tool now places a complete position object with one chart click.
- Position has three price levels: Entry, TP and SL.
- Entry→TP is translucent green; Entry→SL is translucent red.
- Drag TP or SL vertically to edit the corresponding price.
- Hover the position body to get a grab cursor; drag the body to move the whole position across bars and prices.
- Moving the whole position preserves risk/reward distances while updating Entry, TP and SL from the current Y-axis scale.
- Moving horizontally changes the position candle location and its replay outcome start index.
- Drawings stay anchored to bar index + price so zoom/pan/Y-scale changes keep them attached to the chart.
- Drawings are removed only manually or when chart data is reloaded.
