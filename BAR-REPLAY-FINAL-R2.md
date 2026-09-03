# Bar Replay FINAL R2

- Fix Long/Short exit evaluation so TP/SL can never be registered before the visual Entry bar.
- This prevents closed-position exit arrows from pointing left into the past when an object is placed or moved ahead of the replay cursor.
- Applies symmetrically to LONG and SHORT positions.
