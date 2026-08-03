import test from "node:test";
import assert from "node:assert/strict";
import { fetchBybitClosedDailyCandles } from "../lib/bybit.js";
import { fetchOkxClosedDailyCandles } from "../lib/okx.js";

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
