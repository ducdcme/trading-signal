import test from "node:test";
import assert from "node:assert/strict";
import { ensureFreshCandles, resolveAndFetchClosedDailyCandles, resolveFocusCandles } from "../lib/market.js";
import { parseInstrument } from "../lib/instruments.js";
import { clearMarketCatalogCache } from "../lib/market-catalog.js";

const realFetch = globalThis.fetch;
const response = payload => ({ ok: true, status: 200, statusText: "OK", text: async () => JSON.stringify(payload) });
const errorResponse = (status, payload) => ({ ok: false, status, statusText: "Error", text: async () => JSON.stringify(payload) });
const dailyRows = () => Array.from({ length: 101 }, (_, index) => {
  const openTime = Date.now() - (101 - index) * 86_400_000;
  return [String(openTime), "1", "2", "0.5", "1.5", "10", String(openTime + 86_400_000 - 1)];
});

test.afterEach(() => {
  globalThis.fetch = realFetch;
  clearMarketCatalogCache();
});

test("selects the first exchange with an active Spot market", async () => {
  const calls = [];
  globalThis.fetch = async url => {
    const value = String(url);
    calls.push(value);
    if (value.includes("binance") && value.includes("exchangeInfo")) return response({ symbols: [] });
    if (value.includes("bybit") && value.includes("instruments-info")) return response({ retCode: 0, result: { list: [{ status: "Trading", symbol: "MNTUSDT", baseCoin: "MNT", quoteCoin: "USDT" }] } });
    if (value.includes("bybit") && value.includes("kline")) return response({ retCode: 0, result: { list: dailyRows().reverse() } });
    throw new Error(`Unexpected URL: ${value}`);
  };

  const resolved = await resolveAndFetchClosedDailyCandles(parseInstrument("MNT"), 500, ["BINANCE", "BYBIT"]);
  assert.equal(resolved.instrument.exchange, "BYBIT");
  assert.equal(resolved.instrument.instrumentId, "MNTUSDT");
  assert.equal(calls.length, 3);
});

test("continues to later exchanges when OKX catalog API fails", async () => {
  const calls = [];
  globalThis.fetch = async url => {
    const value = String(url);
    calls.push(value);
    if (value.includes("okx.com") && value.includes("instruments")) throw new Error("OKX temporarily unavailable");
    if (value.includes("bybit") && value.includes("instruments-info")) return response({ retCode: 0, result: { list: [{ status: "Trading", symbol: "MNTUSDT", baseCoin: "MNT", quoteCoin: "USDT" }] } });
    if (value.includes("bybit") && value.includes("kline")) return response({ retCode: 0, result: { list: dailyRows().reverse() } });
    throw new Error(`Unexpected URL: ${value}`);
  };

  const resolved = await resolveAndFetchClosedDailyCandles(parseInstrument("MNT"), 500, ["OKX", "BYBIT"]);
  assert.equal(resolved.instrument.exchange, "BYBIT");
  assert.match(resolved.sourceWarnings[0], /^OKX catalog:/);
  assert.ok(calls.some(value => value.includes("bybit") && value.includes("instruments-info")));
  assert.ok(calls.some(value => value.includes("bybit") && value.includes("kline")));
});

test("continues to later exchanges when OKX candle API fails", async () => {
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes("okx.com") && value.includes("instruments")) return response({ code: "0", data: [{ state: "live", instId: "MNT-USDT", baseCcy: "MNT", quoteCcy: "USDT" }] });
    if (value.includes("okx.com") && value.includes("history-candles")) throw new Error("OKX candle timeout");
    if (value.includes("bybit") && value.includes("instruments-info")) return response({ retCode: 0, result: { list: [{ status: "Trading", symbol: "MNTUSDT", baseCoin: "MNT", quoteCoin: "USDT" }] } });
    if (value.includes("bybit") && value.includes("kline")) return response({ retCode: 0, result: { list: dailyRows().reverse() } });
    throw new Error(`Unexpected URL: ${value}`);
  };

  const resolved = await resolveAndFetchClosedDailyCandles(parseInstrument("MNT"), 500, ["OKX", "BYBIT"]);
  assert.equal(resolved.instrument.exchange, "BYBIT");
  assert.match(resolved.sourceWarnings[0], /^OKX MNT-USDT:/);
});

test("does not select delisted Binance markets even when historical klines may exist", async () => {
  const calls = [];
  globalThis.fetch = async url => {
    const value = String(url);
    calls.push(value);
    if (value.includes("binance") && value.includes("exchangeInfo")) return response({ symbols: [] });
    if (value.includes("bybit") && value.includes("instruments-info")) return response({ retCode: 0, result: { list: [{ status: "Trading", symbol: "BLZUSDT", baseCoin: "BLZ", quoteCoin: "USDT" }] } });
    if (value.includes("bybit") && value.includes("kline")) return response({ retCode: 0, result: { list: dailyRows().reverse() } });
    throw new Error(`Unexpected URL: ${value}`);
  };

  const resolved = await resolveAndFetchClosedDailyCandles(parseInstrument("BLZ"), 500, ["BINANCE", "BYBIT"], undefined, ["USDT"]);
  assert.equal(resolved.instrument.exchange, "BYBIT");
  assert.ok(!calls.some(value => value.includes("binance") && value.includes("klines")));
});

test("allows FDUSD only on Binance", async () => {
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes("binance") && value.includes("exchangeInfo")) return response({ symbols: [{ status: "TRADING", isSpotTradingAllowed: true, symbol: "ABCDFDUSD", baseAsset: "ABCD", quoteAsset: "FDUSD" }] });
    if (value.includes("binance") && value.includes("klines")) return response(dailyRows());
    throw new Error(`Unexpected URL: ${value}`);
  };
  const resolved = await resolveAndFetchClosedDailyCandles(parseInstrument("ABCD"), 500, ["BINANCE"], undefined, ["USDT", "USDC", "FDUSD"]);
  assert.equal(resolved.instrument.instrumentId, "ABCDFDUSD");
});

test("rejects stale candles before signal calculation", () => {
  const staleClose = Date.UTC(2024, 11, 25);
  assert.throws(
    () => ensureFreshCandles([{ closeTime: staleClose }], "1D", "BINANCE", "BLZUSDT", Date.UTC(2026, 7, 4)),
    error => error.name === "MarketNotFoundError" && /nến cuối 2024-12-25/.test(error.message)
  );
});

test("focus retries the source exchange twice before using a fallback exchange", async () => {
  let binanceCandles = 0;
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes("binance") && value.includes("exchangeInfo")) return response({ symbols: [{ status: "TRADING", isSpotTradingAllowed: true, symbol: "CHIPUSDT", baseAsset: "CHIP", quoteAsset: "USDT" }] });
    if (value.includes("binance") && value.includes("klines")) {
      binanceCandles += 1;
      const error = new Error("The operation was aborted due to timeout");
      error.name = "TimeoutError";
      throw error;
    }
    if (value.includes("bybit") && value.includes("instruments-info")) return response({ retCode: 0, result: { list: [{ status: "Trading", symbol: "CHIPUSDT", baseCoin: "CHIP", quoteCoin: "USDT" }] } });
    if (value.includes("bybit") && value.includes("kline")) return response({ retCode: 0, result: { list: dailyRows().reverse() } });
    throw new Error(`Unexpected URL: ${value}`);
  };

  const resolved = await resolveFocusCandles(
    { asset: "CHIP", exchange: "BINANCE", instrumentId: "CHIPUSDT" },
    "1D", 500, ["BINANCE", "BYBIT"], ["USDT"], { retryDelays: [0, 0] }
  );
  assert.equal(binanceCandles, 3);
  assert.equal(resolved.fallbackUsed, true);
  assert.equal(resolved.instrument.exchange, "BYBIT");
  assert.match(resolved.sourceWarnings[0], /^BINANCE CHIPUSDT:/);
});

test("focus retries HTTP 429 and keeps the source exchange when retry succeeds", async () => {
  let binanceCandles = 0;
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes("exchangeInfo")) return response({ symbols: [{ status: "TRADING", isSpotTradingAllowed: true, symbol: "ARKUSDT", baseAsset: "ARK", quoteAsset: "USDT" }] });
    if (value.includes("klines")) {
      binanceCandles += 1;
      return binanceCandles < 3 ? errorResponse(429, { msg: "Too many requests" }) : response(dailyRows());
    }
    throw new Error(`Unexpected URL: ${value}`);
  };

  const resolved = await resolveFocusCandles(
    { asset: "ARK", exchange: "BINANCE", instrumentId: "ARKUSDT" },
    "1D", 500, ["BINANCE", "BYBIT"], ["USDT"], { retryDelays: [0, 0] }
  );
  assert.equal(binanceCandles, 3);
  assert.equal(resolved.fallbackUsed, false);
  assert.equal(resolved.instrument.exchange, "BINANCE");
});
