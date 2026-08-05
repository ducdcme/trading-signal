import test from "node:test";
import assert from "node:assert/strict";
import { quoteFromCandles } from "../lib/quotes.js";

const instrument = { asset: "BTC", exchange: "BINANCE", instrumentId: "BTCUSDT", quote: "USDT" };

test("quote compares the live D1 candle with the previous daily close", () => {
  const now = Date.UTC(2026, 7, 5, 8);
  const quote = quoteFromCandles(instrument, [
    { openTime: Date.UTC(2026, 7, 4), closeTime: Date.UTC(2026, 7, 4, 23, 59), close: 100 },
    { openTime: Date.UTC(2026, 7, 5), closeTime: Date.UTC(2026, 7, 5, 23, 59), close: 105 }
  ], now);
  assert.equal(quote.price, 105);
  assert.equal(quote.previousClose, 100);
  assert.equal(quote.changePercent, 5);
  assert.equal(quote.isLive, true);
});

test("quote uses the preceding close when the latest candle has closed", () => {
  const now = Date.UTC(2026, 7, 6, 1);
  const quote = quoteFromCandles(instrument, [
    { openTime: Date.UTC(2026, 7, 4), closeTime: Date.UTC(2026, 7, 4, 23, 59), close: 100 },
    { openTime: Date.UTC(2026, 7, 5), closeTime: Date.UTC(2026, 7, 5, 23, 59), close: 95 }
  ], now);
  assert.equal(quote.price, 95);
  assert.equal(quote.previousClose, 100);
  assert.equal(quote.changePercent, -5);
  assert.equal(quote.isLive, false);
});
