import test from "node:test";
import assert from "node:assert/strict";
import { replayCandleCount, replayCandles, replayIndexFromCanvasX, stepReplayIndex } from "../public/chart-replay.js";

test("replay candle cutoff includes the cursor candle", () => {
  const candles = [0, 1, 2, 3, 4];
  assert.equal(replayCandleCount(candles.length, 2), 3);
  assert.deepEqual(replayCandles(candles, 2), [0, 1, 2]);
  assert.deepEqual(replayCandles(candles, null), candles);
});

test("replay index maps canvas slot to historical candle", () => {
  const layout = { margin: { left: 10, right: 20 }, width: 330, step: 30, startIndex: 4 };
  assert.equal(replayIndexFromCanvasX(11, layout, 20), 4);
  assert.equal(replayIndexFromCanvasX(99, layout, 20), 6);
  assert.equal(replayIndexFromCanvasX(329, layout, 20), null);
});

test("replay stepping is clamped to available history", () => {
  assert.equal(stepReplayIndex(3, 1, 5), 4);
  assert.equal(stepReplayIndex(4, 1, 5), 4);
  assert.equal(stepReplayIndex(0, -1, 5), 0);
});
