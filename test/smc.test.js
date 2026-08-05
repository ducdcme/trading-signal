import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMarketStructure, buildSmcLayers, findEqualLevels, findFairValueGaps, findOrderBlocks, findPremiumDiscountRange, findStructurePivots } from "../public/smc.js";

const candle = (high, low, close, isClosed = true) => ({ open: close, high, low, close, isClosed });

test("SMC pivot chỉ được xác nhận sau đủ nến bên phải", () => {
  const candles = [candle(2, 0, 1), candle(3, 1, 2), candle(8, 2, 4), candle(4, 1, 2), candle(3, 0, 1)];
  assert.deepEqual(findStructurePivots(candles, 2).filter(item => item.type === "HIGH"), [
    { type: "HIGH", index: 2, confirmedIndex: 4, price: 8 }
  ]);
});

test("SMC dùng close để xác nhận BOS, không dùng riêng râu nến", () => {
  const candles = [
    candle(3, 1, 2), candle(5, 2, 4), candle(10, 3, 6), candle(6, 2, 4), candle(5, 1, 3),
    candle(11, 2, 9), candle(12, 4, 10.5)
  ];
  const result = analyzeMarketStructure(candles, { pivotLength: 2 });
  assert.equal(result.breaks.length, 1);
  assert.deepEqual(result.breaks[0], { type: "BOS", direction: "BULLISH", index: 6, price: 10, pivotIndex: 2 });
});

test("SMC đổi hướng từ BOS tăng sang CHoCH giảm", () => {
  const candles = [
    candle(5, 3, 4), candle(7, 2, 5), candle(10, 3, 6), candle(7, 2, 4), candle(6, 1, 3),
    candle(11, 2, 10.5), candle(8, 3, 5), candle(7, 0, 0.5)
  ];
  const result = analyzeMarketStructure(candles, { pivotLength: 2 });
  assert.deepEqual(result.breaks.map(item => [item.type, item.direction]), [["BOS", "BULLISH"], ["CHoCH", "BEARISH"]]);
  assert.equal(result.trend, -1);
});

test("SMC bỏ qua nến đang chạy và tạo riêng Swing/Internal", () => {
  const candles = [
    candle(3, 1, 2), candle(5, 2, 4), candle(10, 3, 6), candle(6, 2, 4), candle(5, 1, 3),
    candle(12, 2, 11, false)
  ];
  assert.equal(analyzeMarketStructure(candles, { pivotLength: 2 }).breaks.length, 0);
  const layers = buildSmcLayers(candles);
  assert.equal(layers.swing.pivotLength, 5);
  assert.equal(layers.internal.pivotLength, 2);
});

test("Order Block lấy nến đối ứng cuối cùng trước điểm phá và đánh dấu vô hiệu", () => {
  const candles = [
    { open: 8, high: 10, low: 7, close: 9, isClosed: true },
    { open: 9, high: 9.5, low: 7.5, close: 8, isClosed: true },
    { open: 8, high: 10, low: 8, close: 9.5, isClosed: true },
    { open: 9.5, high: 12, low: 9, close: 11.5, isClosed: true },
    { open: 11, high: 11.2, low: 7, close: 7.4, isClosed: true }
  ];
  const blocks = findOrderBlocks(candles, { breaks: [{ direction: "BULLISH", index: 3, pivotIndex: 0 }] });
  assert.deepEqual(blocks[0], { direction: "BULLISH", index: 1, confirmedIndex: 3, top: 9.5, bottom: 7.5, mitigatedIndex: 4, active: false });
});

test("FVG dùng ba nến đã đóng và nhận biết khi khoảng trống được lấp", () => {
  const candles = [
    { open: 9, high: 10, low: 8, close: 9, isClosed: true },
    { open: 10, high: 12, low: 9, close: 11, isClosed: true },
    { open: 11, high: 13, low: 11, close: 12, isClosed: true },
    { open: 12, high: 12.5, low: 9.5, close: 10, isClosed: true }
  ];
  const gap = findFairValueGaps(candles)[0];
  assert.deepEqual(gap, { direction: "BULLISH", index: 0, confirmedIndex: 2, top: 11, bottom: 10, mitigatedIndex: 3, active: false });
});

test("Equal High/Low dùng ngưỡng thích nghi ATR", () => {
  const candles = Array.from({ length: 8 }, (_, index) => ({ open: 9, high: 10 + (index % 2), low: 8, close: 9, isClosed: true }));
  const pivots = [
    { type: "HIGH", index: 2, confirmedIndex: 3, price: 10 },
    { type: "LOW", index: 3, confirmedIndex: 4, price: 8 },
    { type: "HIGH", index: 5, confirmedIndex: 6, price: 10.05 },
    { type: "LOW", index: 6, confirmedIndex: 7, price: 7.96 }
  ];
  assert.deepEqual(findEqualLevels(candles, pivots).map(level => level.type), ["EQH", "EQL"]);
});

test("SMC phase 2 được tạo thành các lớp độc lập", () => {
  const candles = Array.from({ length: 30 }, (_, index) => ({ open: 10, high: 12 + Math.sin(index), low: 8 + Math.sin(index), close: 10 + Math.sin(index), isClosed: true }));
  const layers = buildSmcLayers(candles);
  assert.ok(Array.isArray(layers.orderBlocks));
  assert.ok(Array.isArray(layers.fairValueGaps));
  assert.ok(Array.isArray(layers.equalLevels));
});

test("Premium/Discount dùng cặp Low-High gần nhất khi cấu trúc tăng", () => {
  const candles = Array.from({ length: 12 }, () => candle(12, 8, 10));
  const structure = {
    trend: 1,
    pivots: [
      { type: "LOW", index: 2, confirmedIndex: 4, price: 80 },
      { type: "HIGH", index: 6, confirmedIndex: 8, price: 100 },
      { type: "LOW", index: 9, confirmedIndex: 11, price: 90 }
    ]
  };
  assert.deepEqual(findPremiumDiscountRange(candles, structure), {
    direction: "BULLISH", fromIndex: 2, toIndex: 6, confirmedIndex: 8,
    low: 80, high: 100, equilibrium: 90
  });
});

test("Premium/Discount dùng cặp High-Low gần nhất khi cấu trúc giảm", () => {
  const candles = Array.from({ length: 12 }, () => candle(12, 8, 10));
  const structure = {
    trend: -1,
    pivots: [
      { type: "HIGH", index: 1, confirmedIndex: 3, price: 120 },
      { type: "LOW", index: 5, confirmedIndex: 7, price: 100 },
      { type: "HIGH", index: 7, confirmedIndex: 9, price: 110 },
      { type: "LOW", index: 9, confirmedIndex: 11, price: 90 }
    ]
  };
  assert.deepEqual(findPremiumDiscountRange(candles, structure), {
    direction: "BEARISH", fromIndex: 7, toIndex: 9, confirmedIndex: 11,
    low: 90, high: 110, equilibrium: 100
  });
});

test("Premium/Discount không tạo vùng khi thiếu xu hướng hoặc cặp swing hợp lệ", () => {
  const candles = Array.from({ length: 6 }, () => candle(12, 8, 10));
  assert.equal(findPremiumDiscountRange(candles, { trend: 0, pivots: [] }), null);
  assert.equal(findPremiumDiscountRange(candles, { trend: 1, pivots: [{ type: "HIGH", index: 3, confirmedIndex: 5, price: 12 }] }), null);
});

test("SMC phase 3 xuất Premium/Discount như một lớp độc lập", () => {
  const candles = Array.from({ length: 30 }, (_, index) => ({ open: 10, high: 12 + Math.sin(index), low: 8 + Math.sin(index), close: 10 + Math.sin(index), isClosed: true }));
  assert.ok(Object.hasOwn(buildSmcLayers(candles), "premiumDiscount"));
});
