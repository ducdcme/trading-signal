import test from "node:test";
import assert from "node:assert/strict";
import { parseSymbols } from "../public/symbols.js";

test("parses a TradingView watchlist export", () => {
  const text = "### Main crypto\nBINANCE:BTCUSDT,BINANCE:ETHUSDT\nBINANCE:ATOMUSDT";
  assert.deepEqual(parseSymbols(text), ["BINANCE:BTC", "BINANCE:ETH", "BINANCE:ATOM"]);
});

test("parses manual symbols and removes duplicates", () => {
  assert.deepEqual(parseSymbols("btc, ETHUSDT\nBTC\nSOL/USDT"), ["BTC", "ETH", "SOL"]);
});

test("keeps an explicit exchange override", () => {
  assert.deepEqual(parseSymbols("MNT, BYBIT:MNTUSDT, OKX:PI-USDT"), ["MNT", "BYBIT:MNT", "OKX:PI"]);
});
