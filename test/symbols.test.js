import test from "node:test";
import assert from "node:assert/strict";
import { parseSymbols } from "../public/symbols.js";

test("parses a TradingView watchlist export", () => {
  const text = "### Main crypto\nBINANCE:BTCUSDT,BINANCE:ETHUSDT\nBINANCE:ATOMUSDT";
  assert.deepEqual(parseSymbols(text), ["BTC", "ETH", "ATOM"]);
});

test("parses manual symbols and removes duplicates", () => {
  assert.deepEqual(parseSymbols("btc, ETHUSDT\nBTC\nSOL/USDT"), ["BTC", "ETH", "SOL"]);
});

test("removes source exchanges so the server can apply exchange priority", () => {
  assert.deepEqual(parseSymbols("MNT, BYBIT:MNTUSDT, OKX:PI-USDT"), ["MNT", "PI"]);
});

test("removes all supported stable quotes", () => {
  assert.deepEqual(parseSymbols("BTCUSDT, ETHUSDC, BNBFDUSD"), ["BTC", "ETH", "BNB"]);
});
