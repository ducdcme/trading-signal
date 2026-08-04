import test from "node:test";
import assert from "node:assert/strict";
import { parseInstrument, parseInstruments } from "../lib/instruments.js";

test("bare coin uses automatic exchange discovery", () => {
  assert.deepEqual(parseInstrument("MNT"), { exchange: "AUTO", asset: "MNT", quote: null, instrumentId: "MNT", key: "MNT" });
});

test("formats explicit exchange instruments", () => {
  assert.equal(parseInstrument("BYBIT:MNT").instrumentId, "MNTUSDT");
  assert.equal(parseInstrument("OKX:PI").instrumentId, "PI-USDT");
  assert.equal(parseInstrument("BYBIT:ABCUSDC").instrumentId, "ABCUSDC");
  assert.equal(parseInstrument("OKX:ABC-USDC").instrumentId, "ABC-USDC");
});

test("formats the four additional exchange symbol conventions", () => {
  assert.equal(parseInstrument("BITGET:BTC").instrumentId, "BTCUSDT");
  assert.equal(parseInstrument("KUCOIN:BTC").instrumentId, "BTC-USDT");
  assert.equal(parseInstrument("GATE:BTC").instrumentId, "BTC_USDT");
  assert.equal(parseInstrument("MEXC:BTC").instrumentId, "BTCUSDT");
});

test("keeps only the first occurrence of the same asset across exchanges", () => {
  const rows = parseInstruments(["BTC", "MEXC:BTC", "BINANCE:BTC"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].exchange, "AUTO");
});

test("deduplicates the same requested instrument", () => {
  assert.equal(parseInstruments(["PI", "PIUSDT"]).length, 1);
});
