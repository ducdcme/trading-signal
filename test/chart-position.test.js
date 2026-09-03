import test from "node:test";
import assert from "node:assert/strict";
import { createPosition, positionOutcome, positionRiskReward, pointInPosition } from "../public/chart-position.js";

test("long position normalizes target and stop around entry", () => {
  const p = createPosition({ id: 1, side: "LONG", entryPoint: { virtualIndex: 10, price: 100 }, targetPoint: { virtualIndex: 15, price: 110 }, stopPoint: { virtualIndex: 14, price: 95 }, createdAtIndex: 10 });
  assert.equal(p.target, 110); assert.equal(p.stop, 95); assert.equal(p.endIndex, 15);
  assert.equal(positionRiskReward(p), 2);
});

test("position outcome detects win and lose", () => {
  const long = createPosition({ id: 1, side: "LONG", entryPoint: { virtualIndex: 0, price: 100 }, targetPoint: { virtualIndex: 3, price: 110 }, stopPoint: { virtualIndex: 3, price: 95 }, createdAtIndex: 0 });
  assert.equal(positionOutcome(long, [{high:101,low:99},{high:111,low:98}], 1).status, "WIN");
  const short = createPosition({ id: 2, side: "SHORT", entryPoint: { virtualIndex: 0, price: 100 }, targetPoint: { virtualIndex: 3, price: 90 }, stopPoint: { virtualIndex: 3, price: 105 }, createdAtIndex: 0 });
  assert.equal(positionOutcome(short, [{high:101,low:99},{high:106,low:94}], 1).status, "LOSE");
});

test("same bar target and stop is ambiguous", () => {
  const p = createPosition({ id: 1, side: "LONG", entryPoint: { virtualIndex: 0, price: 100 }, targetPoint: { virtualIndex: 3, price: 110 }, stopPoint: { virtualIndex: 3, price: 95 }, createdAtIndex: 0 });
  assert.equal(positionOutcome(p, [{high:101,low:99},{high:111,low:94}], 1).status, "AMBIGUOUS");
});

test("hit testing uses chart coordinates", () => {
  const p = createPosition({ id: 1, side: "LONG", entryPoint: { virtualIndex: 10, price: 100 }, targetPoint: { virtualIndex: 20, price: 110 }, stopPoint: { virtualIndex: 20, price: 95 }, createdAtIndex: 10 });
  assert.equal(pointInPosition(p, { virtualIndex: 15, price: 103 }), true);
  assert.equal(pointInPosition(p, { virtualIndex: 25, price: 103 }), false);
});

test("default position creates TradingView-like long geometry", async () => {
  const { createDefaultPosition } = await import("../public/chart-position.js");
  const p = createDefaultPosition({ id: 7, side: "LONG", point: { virtualIndex: 20, price: 100 }, riskSize: 5, rewardRisk: 2, widthBars: 10, createdAtIndex: 20 });
  assert.equal(p.entry, 100); assert.equal(p.stop, 95); assert.equal(p.target, 110); assert.equal(p.startIndex, 20); assert.equal(p.endIndex, 30);
});

test("moving a position updates candle location and all price levels", async () => {
  const { translatePosition } = await import("../public/chart-position.js");
  const p = { id:1, side:"LONG", entry:100, stop:95, target:110, startIndex:10, endIndex:20, createdAtIndex:10 };
  const moved = translatePosition(p, 4.5, 12, 100);
  assert.equal(moved.entry, 112); assert.equal(moved.stop, 107); assert.equal(moved.target, 122); assert.equal(moved.startIndex, 14.5); assert.equal(moved.endIndex, 24.5); assert.equal(moved.createdAtIndex, 15);
});

test("TP and SL handles keep levels on the correct side of entry", async () => {
  const { setPositionLevel } = await import("../public/chart-position.js");
  const long = { side:"LONG", entry:100, target:110, stop:95 };
  assert.equal(setPositionLevel(long, "target", 90).target, 100);
  assert.equal(setPositionLevel(long, "stop", 120).stop, 100);
  const short = { side:"SHORT", entry:100, target:90, stop:105 };
  assert.equal(setPositionLevel(short, "target", 120).target, 100);
  assert.equal(setPositionLevel(short, "stop", 80).stop, 100);
});


test("position right edge resizes only the time axis", async () => {
  const { setPositionEnd } = await import("../public/chart-position.js");
  const p = { id:1, side:"LONG", entry:100, stop:95, target:110, startIndex:10, endIndex:20, createdAtIndex:10 };
  const resized = setPositionEnd(p, 34);
  assert.equal(resized.endIndex, 34);
  assert.equal(resized.startIndex, 10);
  assert.equal(resized.entry, 100); assert.equal(resized.stop, 95); assert.equal(resized.target, 110);
  assert.equal(setPositionEnd(p, 9).endIndex, 12);
});

test("closed position outcome exposes exact exit price for drawing", () => {
  const long = createPosition({ id: 1, side: "LONG", entryPoint: { virtualIndex: 0, price: 100 }, targetPoint: { virtualIndex: 3, price: 110 }, stopPoint: { virtualIndex: 3, price: 95 }, createdAtIndex: 0 });
  const win = positionOutcome(long, [{high:101,low:99},{high:111,low:98}], 1);
  assert.equal(win.status, "WIN"); assert.equal(win.hitIndex, 1); assert.equal(win.exitPrice, 110);
  const lose = positionOutcome(long, [{high:101,low:99},{high:104,low:94}], 1);
  assert.equal(lose.status, "LOSE"); assert.equal(lose.hitIndex, 1); assert.equal(lose.exitPrice, 95);
});


test("position outcome never exits before the visual entry bar", () => {
  const candles = Array.from({ length: 12 }, () => ({ high: 101, low: 99 }));
  // A SHORT target is hit on bar 4, but the object Entry is visually at bar 7.
  candles[4] = { high: 101, low: 89 };
  candles[9] = { high: 101, low: 89 };
  const short = {
    id: 99, side: "SHORT", entry: 100, target: 90, stop: 105,
    startIndex: 7, endIndex: 11, createdAtIndex: 2
  };
  const result = positionOutcome(short, candles, 11);
  assert.equal(result.status, "WIN");
  assert.equal(result.hitIndex, 9);
});

test("future position remains LIVE until replay reaches a bar after Entry", () => {
  const candles = Array.from({ length: 12 }, () => ({ high: 101, low: 99 }));
  candles[4] = { high: 111, low: 99 };
  const long = {
    id: 100, side: "LONG", entry: 100, target: 110, stop: 95,
    startIndex: 7, endIndex: 11, createdAtIndex: 2
  };
  assert.equal(positionOutcome(long, candles, 6).status, "LIVE");
});
