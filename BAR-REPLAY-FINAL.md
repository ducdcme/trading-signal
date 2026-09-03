# Trading Signal v3.3.1 — Bar Replay FINAL

Bar Replay UI finalized from DEV.8.

Final adjustment:
- SMC Order Block is enabled by default whenever the chart is loaded.
- It can still be disabled manually during the current session.
- Backtest code remains separate and is not merged into Bar Replay.

## FINAL hover fix
- Short Position hover badges now mirror Long correctly: SL above Entry, TP below Entry.
- TP/SL badges stay centered on the object's horizontal midpoint; R:R remains centered inside.
