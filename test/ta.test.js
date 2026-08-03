import test from "node:test";
import assert from "node:assert/strict";
import { ema, highestAt, lowestAt, rsi, sma } from "../lib/ta.js";

test("SMA and extrema", () => {
  assert.deepEqual(sma([1, 2, 3, 4], 3), [null, null, 2, 3]);
  assert.equal(highestAt([1, 5, 2, 4], 3, 3), 5);
  assert.equal(lowestAt([1, 5, 2, 4], 2, 3), 2);
});

test("EMA follows recursive formula", () => {
  assert.deepEqual(ema([1, 2, 3], 3), [1, 1.5, 2.25]);
});

test("RSI rises to 100 for a monotonic series", () => {
  const values = Array.from({ length: 30 }, (_, i) => i + 1);
  assert.equal(rsi(values, 14).at(-1), 100);
});

