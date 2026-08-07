import test from "node:test";
import assert from "node:assert/strict";
import { distanceBetweenPointers, midpointBetweenPointers, pinchBarCount, plotAnchorRatio } from "../public/chart-gestures.js";

test("pinch out reduces visible bars and pinch in increases them", () => {
  assert.equal(pinchBarCount(160, 100, 200), 80);
  assert.equal(pinchBarCount(160, 100, 50), 320);
});

test("invalid pinch distance keeps the current zoom", () => {
  assert.equal(pinchBarCount(160, 0, 200), 160);
  assert.equal(pinchBarCount(160, 100, Number.NaN), 160);
});

test("pointer geometry returns distance and midpoint", () => {
  const first = { clientX: 10, clientY: 20 };
  const second = { clientX: 40, clientY: 60 };
  assert.equal(distanceBetweenPointers(first, second), 50);
  assert.deepEqual(midpointBetweenPointers(first, second), { clientX: 25, clientY: 40 });
});

test("plot anchor is clamped to the visible plot", () => {
  assert.equal(plotAnchorRatio(150, 0, 50, 200), 0.5);
  assert.equal(plotAnchorRatio(10, 0, 50, 200), 0);
  assert.equal(plotAnchorRatio(300, 0, 50, 200), 1);
  assert.equal(plotAnchorRatio(150, 0, 50, 0), 0.5);
});
