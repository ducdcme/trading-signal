import test from "node:test";
import assert from "node:assert/strict";
import { aggregateEightHour, aggregateWeekly, candlesForTimeframe } from "../lib/candles.js";

const HOUR_MS = 60 * 60 * 1000;
const candle4h = (openTime, values = {}) => ({
  openTime,
  closeTime: openTime + 4 * HOUR_MS - 1,
  open: values.open ?? 10,
  high: values.high ?? 12,
  low: values.low ?? 9,
  close: values.close ?? 11,
  volume: values.volume ?? 100
});

test("aggregates two completed UTC 4H candles into one 8H candle", () => {
  const start = Date.UTC(2026, 7, 6, 0);
  const result = aggregateEightHour([
    candle4h(start, { open: 10, high: 14, low: 9, close: 13, volume: 100 }),
    candle4h(start + 4 * HOUR_MS, { open: 13, high: 15, low: 11, close: 12, volume: 150 })
  ], start + 9 * HOUR_MS);
  assert.deepEqual(result, [{
    openTime: start, open: 10, high: 15, low: 9, close: 12, volume: 250,
    closeTime: start + 8 * HOUR_MS - 1
  }]);
});

test("does not create an 8H candle from a missing or still-open 4H candle", () => {
  const start = Date.UTC(2026, 7, 6, 8);
  const candles = [candle4h(start), candle4h(start + 4 * HOUR_MS)];
  assert.equal(aggregateEightHour(candles.slice(0, 1), start + 9 * HOUR_MS).length, 0);
  assert.equal(aggregateEightHour(candles, start + 6 * HOUR_MS).length, 0);
});

test("chart aggregation includes the currently running 8H candle", () => {
  const start = Date.UTC(2026, 7, 6, 8);
  const result = aggregateEightHour([
    candle4h(start, { open: 10, high: 14, low: 9, close: 13, volume: 100 }),
    candle4h(start + 4 * HOUR_MS, { open: 13, high: 16, low: 12, close: 15, volume: 40 })
  ], start + 6 * HOUR_MS, true);
  assert.deepEqual(result, [{
    openTime: start, open: 10, high: 16, low: 9, close: 15, volume: 140,
    closeTime: start + 8 * HOUR_MS - 1
  }]);
});

test("chart aggregation can build the running 8H candle from its first live 4H candle", () => {
  const start = Date.UTC(2026, 7, 6, 16);
  const result = candlesForTimeframe([
    candle4h(start, { open: 20, high: 22, low: 19, close: 21, volume: 50 })
  ], "8H", { includeOpen: true, now: start + 2 * HOUR_MS });
  assert.equal(result.length, 1);
  assert.equal(result[0].close, 21);
  assert.equal(result[0].closeTime, start + 8 * HOUR_MS - 1);
});

test("rejects an 8H bucket containing duplicated 4H open times", () => {
  const start = Date.UTC(2026, 7, 6, 16);
  const first = candle4h(start);
  assert.equal(aggregateEightHour([first, { ...first }, candle4h(start + 4 * HOUR_MS)], start + 9 * HOUR_MS).length, 0);
});

test("routes 8H through the 4H aggregation without changing other timeframes", () => {
  const start = Date.UTC(2026, 7, 6, 0);
  const source = [candle4h(start), candle4h(start + 4 * HOUR_MS)];
  assert.equal(candlesForTimeframe(source, "8H").length, 1);
  assert.equal(candlesForTimeframe(source, "4H"), source);
});

test("aggregates UTC daily candles into completed Monday weeks", () => {
  const monday = Date.UTC(2025, 0, 6);
  const daily = Array.from({ length: 14 }, (_, i) => ({ openTime: monday + i * 86_400_000, closeTime: monday + (i + 1) * 86_400_000 - 1, open: i + 1, high: i + 2, low: i, close: i + 1.5, volume: 10 }));
  const weekly = aggregateWeekly(daily);
  assert.equal(weekly.length, 2);
  assert.equal(weekly[0].open, 1);
  assert.equal(weekly[0].close, 7.5);
  assert.equal(weekly[0].volume, 70);
});
