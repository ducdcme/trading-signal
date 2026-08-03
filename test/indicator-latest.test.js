import test from "node:test";
import assert from "node:assert/strict";
import { calculateSignals } from "../lib/indicator.js";

function candle(open, close, high, low, volume = 1200) {
  return { open, close, high, low, volume, openTime: 0, closeTime: 0 };
}

test("ports the latest Pine TL1 setup and exposes auxiliary alert groups", () => {
  const candles = [];
  for (let index = 0; index < 97; index += 1) {
    const open = 100 + index * 0.5;
    candles.push(candle(open, open + 0.2, open + 0.6, open - 0.6, 1000 + index));
  }
  candles.push(candle(150, 145, 151, 140));
  candles.push(candle(146, 142, 149, 141));
  candles.push(candle(142, 148, 149.5, 141.5));

  const latest = calculateSignals(candles).at(-1);
  assert.ok(latest.buyTypes.includes("TL1"));
  assert.deepEqual(latest.sellTypes, []);
  assert.ok(Array.isArray(latest.warnings));
  assert.ok(Array.isArray(latest.exitTypes));
  assert.ok(Array.isArray(latest.trendTypes));
});
