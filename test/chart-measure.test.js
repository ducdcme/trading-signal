import test from "node:test";
import assert from "node:assert/strict";
import {
  beginMeasurement,
  completeMeasurement,
  measurementPointFromCanvas,
  measurementPointToCanvas,
  measurementStats,
  previewMeasurement
} from "../public/chart-measure.js";

const layout = {
  margin: { left: 10, right: 70, top: 20, bottom: 40 },
  width: 1080,
  height: 560,
  plotWidth: 1000,
  plotHeight: 500,
  startIndex: 100,
  step: 10,
  min: 50,
  max: 150
};

test("measurement converts between chart values and canvas coordinates", () => {
  const point = measurementPointFromCanvas(260, 270, layout);
  assert.deepEqual(point, { virtualIndex: 125, price: 100 });
  assert.deepEqual(measurementPointToCanvas(point, layout), { x: 260, y: 270 });
});

test("measurement clamps pointer to the plot", () => {
  assert.deepEqual(measurementPointFromCanvas(-20, 900, layout), { virtualIndex: 100, price: 50 });
});

test("measurement calculates rising and falling percentages", () => {
  assert.deepEqual(measurementStats({ virtualIndex: 10, price: 80 }, { virtualIndex: 15.4, price: 100 }), {
    delta: 20,
    percent: 25,
    bars: 5,
    rising: true
  });
  assert.equal(measurementStats({ virtualIndex: 15, price: 100 }, { virtualIndex: 11, price: 90 }).rising, false);
});

test("measurement remains active after the Shift start click", () => {
  const start = { virtualIndex: 10, price: 80 };
  assert.deepEqual(beginMeasurement(start), { start, end: start, placingEnd: true });
});

test("measurement previews without Shift and completes on the next click", () => {
  const start = { virtualIndex: 10, price: 80 };
  const preview = { virtualIndex: 13, price: 90 };
  const end = { virtualIndex: 15, price: 100 };
  const active = previewMeasurement(beginMeasurement(start), preview);
  assert.deepEqual(active, { start, end: preview, placingEnd: true });
  assert.deepEqual(completeMeasurement(active, end), { start, end, placingEnd: false });
});
