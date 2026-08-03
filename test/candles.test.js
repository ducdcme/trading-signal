import test from "node:test";
import assert from "node:assert/strict";
import { aggregateWeekly } from "../lib/candles.js";

test("aggregates UTC daily candles into completed Monday weeks", () => {
  const monday = Date.UTC(2025, 0, 6);
  const daily = Array.from({ length: 14 }, (_, i) => ({ openTime: monday + i * 86_400_000, closeTime: monday + (i + 1) * 86_400_000 - 1, open: i + 1, high: i + 2, low: i, close: i + 1.5, volume: 10 }));
  const weekly = aggregateWeekly(daily);
  assert.equal(weekly.length, 2);
  assert.equal(weekly[0].open, 1);
  assert.equal(weekly[0].close, 7.5);
  assert.equal(weekly[0].volume, 70);
});
