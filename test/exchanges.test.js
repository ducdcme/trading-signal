import test from "node:test";
import assert from "node:assert/strict";
import { fetchBybitClosedDailyCandles } from "../lib/bybit.js";
import { fetchOkxClosedDailyCandles } from "../lib/okx.js";
import { fetchBitgetClosedCandles } from "../lib/bitget.js";
import { fetchKucoinClosedCandles } from "../lib/kucoin.js";
import { fetchGateClosedCandles } from "../lib/gate.js";
import { fetchMexcClosedCandles } from "../lib/mexc.js";

const realFetch = globalThis.fetch;
const response = payload => ({ ok: true, status: 200, statusText: "OK", text: async () => JSON.stringify(payload) });

test.afterEach(() => { globalThis.fetch = realFetch; });

test("normalizes reverse-ordered Bybit daily candles", async () => {
  const now = Date.now();
  globalThis.fetch = async () => response({ retCode: 0, result: { list: [
    [String(now - 2 * 86_400_000), "2", "3", "1", "2.5", "20", ""],
    [String(now - 3 * 86_400_000), "1", "2", "0.5", "1.5", "10", ""]
  ] } });
  const candles = await fetchBybitClosedDailyCandles("MNTUSDT", 100);
  assert.equal(candles.length, 2);
  assert.ok(candles[0].openTime < candles[1].openTime);
});

test("classifies Bybit Not supported symbols as a missing market", async () => {
  globalThis.fetch = async () => response({ retCode: 10001, retMsg: "Not supported symbols", result: {} });
  await assert.rejects(
    () => fetchBybitClosedDailyCandles("BOBOUSDT", 100),
    error => error.name === "MarketNotFoundError" && /không có cặp Spot/.test(error.message)
  );
});

test("uses only confirmed OKX candles", async () => {
  const now = Date.now();
  globalThis.fetch = async () => response({ code: "0", data: [
    [String(now - 2 * 86_400_000), "2", "3", "1", "2.5", "20", "", "", "1"],
    [String(now - 86_400_000), "2", "3", "1", "2.2", "20", "", "", "0"]
  ] });
  const candles = await fetchOkxClosedDailyCandles("PI-USDT", 100);
  assert.equal(candles.length, 1);
  assert.equal(candles[0].close, 2.5);
});

test("normalizes Bitget intraday candles", async () => {
  const open = Date.now() - 2 * 3_600_000;
  globalThis.fetch = async () => response({ code: "00000", data: [[String(open), "1", "2", "0.5", "1.5", "10"]] });
  const candles = await fetchBitgetClosedCandles("BTCUSDT", "1H", 100);
  assert.equal(candles[0].close, 1.5);
});

test("normalizes KuCoin candle column order", async () => {
  const openSeconds = Math.floor(Date.now() / 1000) - 2 * 14_400;
  globalThis.fetch = async () => response({ code: "200000", data: [[String(openSeconds), "1", "1.5", "2", "0.5", "10", "15"]] });
  const candles = await fetchKucoinClosedCandles("BTC-USDT", "4H", 100);
  assert.deepEqual([candles[0].open, candles[0].high, candles[0].low, candles[0].close], [1, 2, 0.5, 1.5]);
});

test("normalizes Gate and MEXC candles", async () => {
  const openSeconds = Math.floor(Date.now() / 1000) - 2 * 86_400;
  globalThis.fetch = async url => String(url).includes("gateio")
    ? response([[String(openSeconds), "15", "1.5", "2", "0.5", "1", "10"]])
    : response([[openSeconds * 1000, "1", "2", "0.5", "1.5", "10", openSeconds * 1000 + 86_400_000 - 1]]);
  assert.equal((await fetchGateClosedCandles("BTC_USDT", "1D", 100))[0].open, 1);
  assert.equal((await fetchMexcClosedCandles("BTCUSDT", "1D", 100))[0].close, 1.5);
});
