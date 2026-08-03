import test from "node:test";
import assert from "node:assert/strict";
import { resolveAndFetchClosedDailyCandles } from "../lib/market.js";
import { parseInstrument } from "../lib/instruments.js";

const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });

test("tries Binance before Bybit and stops on the first usable market", async () => {
  const calls = [];
  const day = 86_400_000;
  const rows = Array.from({ length: 101 }, (_, index) => {
    const openTime = Date.now() - (index + 2) * day;
    return [String(openTime), "1", "2", "0.5", "1.5", "10", ""];
  });
  globalThis.fetch = async url => {
    calls.push(String(url));
    if (String(url).includes("binance")) {
      return { ok: false, status: 400, statusText: "Bad Request", text: async () => JSON.stringify({ msg: "Invalid symbol" }) };
    }
    return { ok: true, status: 200, statusText: "OK", text: async () => JSON.stringify({ retCode: 0, result: { list: rows } }) };
  };
  const resolved = await resolveAndFetchClosedDailyCandles(parseInstrument("MNT"), 500, ["BINANCE", "BYBIT", "OKX"]);
  assert.equal(resolved.instrument.exchange, "BYBIT");
  assert.equal(resolved.instrument.instrumentId, "MNTUSDT");
  assert.equal(calls.length, 3);
  assert.ok(calls[1].includes("MNTUSDC"));
});
