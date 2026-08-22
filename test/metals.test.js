import test from "node:test";
import assert from "node:assert/strict";
import { buildMetalComparison, fetchMetalCandles, normalizeMetalCandles, normalizeMetalSelection } from "../lib/metals.js";

test("domestic products default to SELL and world products require MID", () => {
  assert.equal(normalizeMetalSelection("VN_GOLD_SJC_BAR").side, "SELL");
  assert.equal(normalizeMetalSelection("XAU_USD").side, "MID");
  assert.throws(() => normalizeMetalSelection("XAU_USD", "SELL"), /Chiều giá/);
});

test("collector D1 rows become normalized chart candles", () => {
  const selection = normalizeMetalSelection("VN_GOLD_RING_9999", "BUY");
  const [candle] = normalizeMetalCandles([{
    date: "2026-08-21", open: 143000000, high: 144000000,
    low: 142500000, close: 143500000, sampleCount: 8,
    quality: "LIVE", isComplete: true
  }], selection);
  assert.equal(candle.open, 143000000);
  assert.equal(candle.volume, 8);
  assert.equal(new Date(candle.openTime).toISOString(), "2026-08-20T17:00:00.000Z");
  assert.equal(candle.ohlcMode, "OBSERVED");
});

test("derives a domestic change candle from the previous close for one-sample history", () => {
  const selection = normalizeMetalSelection("VN_SILVER_999_KG", "BUY");
  const candles = normalizeMetalCandles([
    { date: "2026-08-20", open: 60000000, high: 60000000, low: 60000000, close: 60000000, sampleCount: 1, quality: "BACKFILL_VERIFIED", isComplete: true },
    { date: "2026-08-21", open: 62106511, high: 62106511, low: 62106511, close: 62106511, sampleCount: 1, quality: "BACKFILL_VERIFIED", isComplete: true }
  ], selection);
  assert.deepEqual(
    { open: candles[1].open, high: candles[1].high, low: candles[1].low, close: candles[1].close },
    { open: 60000000, high: 62106511, low: 60000000, close: 62106511 }
  );
  assert.equal(candles[1].ohlcMode, "PREVIOUS_CLOSE_DERIVED");
});

test("keeps observed domestic OHLC when a day contains several samples", () => {
  const selection = normalizeMetalSelection("VN_GOLD_SJC_BAR", "SELL");
  const candles = normalizeMetalCandles([
    { date: "2026-08-20", open: 140000000, high: 140000000, low: 140000000, close: 140000000, sampleCount: 1, quality: "BACKFILL_VERIFIED", isComplete: true },
    { date: "2026-08-21", open: 141000000, high: 143000000, low: 140500000, close: 142000000, sampleCount: 4, quality: "LIVE", isComplete: true }
  ], selection);
  assert.deepEqual(
    { open: candles[1].open, high: candles[1].high, low: candles[1].low, close: candles[1].close },
    { open: 141000000, high: 143000000, low: 140500000, close: 142000000 }
  );
  assert.equal(candles[1].ohlcMode, "OBSERVED");
});

test("fetchMetalCandles requests only the selected product and side", async () => {
  let requestedUrl;
  const fetchImpl = async url => {
    requestedUrl = url;
    return new Response(JSON.stringify({ candles: [{
      date: "2026-08-20", open: 3330.1, high: 3350.2,
      low: 3320.4, close: 3344.8, quality: "LIVE_OHLC", isComplete: true
    }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const result = await fetchMetalCandles("XAU_USD", "MID", 365, {
    baseUrl: "http://127.0.0.1:8787", fetchImpl
  });
  assert.match(String(requestedUrl), /product=XAU_USD/);
  assert.match(String(requestedUrl), /side=MID/);
  assert.match(String(requestedUrl), /complete=false/);
  assert.equal(result.candles.length, 1);
});

test("automation requests closed domestic SELL candles only", async () => {
  let requestedUrl;
  const fetchImpl = async url => {
    requestedUrl = url;
    return new Response(JSON.stringify({ candles: [{
      date: "2026-08-20", open: 140000000, high: 142000000,
      low: 139000000, close: 141000000, sampleCount: 5,
      quality: "LIVE", isComplete: true
    }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  await fetchMetalCandles("VN_GOLD_SJC_BAR", "SELL", 500, {
    baseUrl: "http://127.0.0.1:8787", fetchImpl, completeOnly: true
  });
  assert.match(String(requestedUrl), /product=VN_GOLD_SJC_BAR/);
  assert.match(String(requestedUrl), /side=SELL/);
  assert.match(String(requestedUrl), /complete=true/);
});

test("converts world gold and silver into domestic units and calculates both sides", () => {
  const comparison = buildMetalComparison({
    generatedAt: 123456,
    products: [
      { productId: "XAU_USD", price: 2000 },
      { productId: "XAG_USD", close: 25 },
      { productId: "USD_VND", price: 25000 },
      { productId: "VN_GOLD_SJC_BAR", buy: 61000000, sell: 62000000, provider: "SJC", sourceUpdatedAt: 111 },
      { productId: "VN_GOLD_RING_9999", buy: 60000000, sell: 60500000 },
      { productId: "VN_SILVER_999_KG", buy: 20500000, sell: 21000000 }
    ]
  });
  const expectedGold = 2000 * 25000 * 37.5 / 31.1034768;
  const expectedSilver = 25 * 25000 * 1000 / 31.1034768;
  assert.equal(comparison.generatedAt, 123456);
  assert.ok(Math.abs(comparison.benchmarks.goldVndPerLuong - expectedGold) < 0.000001);
  assert.ok(Math.abs(comparison.benchmarks.silverVndPerKg - expectedSilver) < 0.000001);
  assert.equal(comparison.rows.length, 3);
  assert.equal(comparison.rows[0].buy.difference, 61000000 - expectedGold);
  assert.equal(comparison.rows[2].referenceProductId, "XAG_USD");
  assert.ok(comparison.rows[2].sell.percent > 0);
});

test("comparison reports missing domestic products without breaking and rejects missing references", () => {
  const comparison = buildMetalComparison({ products: [
    { productId: "XAU_USD", price: 2000 },
    { productId: "XAG_USD", price: 25 },
    { productId: "USD_VND", price: 25000 }
  ] });
  assert.equal(comparison.rows.every(row => row.missing), true);
  assert.throws(() => buildMetalComparison({ products: [] }), /Thiếu XAU\/USD/);
});
