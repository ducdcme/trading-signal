import test from "node:test";
import assert from "node:assert/strict";
import { addStockInstrument, classifyStockPrepareResult, fetchStockCandles, fetchStockSymbols, normalizeStockCandles, normalizeStockSymbol, parseStockSymbolList, removeStockInstrument, summarizeStockCandles, syncStockDaily } from "../lib/stocks.js";

test("normalizeStockSymbol validates VN stock symbols", () => {
  assert.equal(normalizeStockSymbol(" fpt "), "FPT");
  assert.throws(() => normalizeStockSymbol("FPT/USDT"), /không hợp lệ/);
});

test("parseStockSymbolList accepts space comma semicolon and newline lists", () => {
  assert.deepEqual(parseStockSymbolList("fpt, mbb\nVCB;FPT  acb"), ["FPT", "MBB", "VCB", "ACB"]);
  assert.throws(() => parseStockSymbolList("FPT BTC/USDT"), /không hợp lệ/);
});

test("normalizeStockCandles converts collector rows to Trading Signal candles", () => {
  const [candle] = normalizeStockCandles([{ date: "2026-08-24", open: 70, high: 72, low: 69, close: 71, volume: 1234 }]);
  assert.equal(candle.open, 70); assert.equal(candle.close, 71); assert.equal(candle.volume, 1234);
  assert.ok(Number.isFinite(candle.openTime)); assert.ok(candle.closeTime > candle.openTime);
});

test("fetchStockSymbols reads collector contract", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ symbols: [{ symbol: "FPT", exchange: "HOSE", name: "FPT" }] }), { status: 200 });
  const rows = await fetchStockSymbols({ baseUrl: "http://stocks/", fetchImpl });
  assert.deepEqual(rows, [{ symbol: "FPT", exchange: "HOSE", name: "FPT" }]);
});

test("fetchStockCandles reads database-backed collector payload", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ provider: "database", candles: [{ date: "2026-08-24", open: 70, high: 72, low: 69, close: 71, volume: 1234 }] }), { status: 200 });
  const result = await fetchStockCandles("FPT", 500, { baseUrl: "http://stocks/", fetchImpl });
  assert.equal(result.provider, "database"); assert.equal(result.candles.length, 1);
});


test("summarizeStockCandles calculates latest D1 change", () => {
  const rows = normalizeStockCandles([
    { date: "2026-08-21", open: 68, high: 70, low: 67, close: 70, volume: 1000 },
    { date: "2026-08-24", open: 70, high: 73, low: 69, close: 72, volume: 2000 }
  ]);
  const summary = summarizeStockCandles(rows);
  assert.equal(summary.close, 72);
  assert.equal(summary.previousClose, 70);
  assert.equal(Number(summary.changePercent.toFixed(4)), 2.8571);
  assert.equal(summary.volume, 2000);
});

test("stock D1 candle closes at 15:15 Vietnam time", () => {
  const [candle] = normalizeStockCandles([{ date: "2026-08-25", open: 70, high: 72, low: 69, close: 71, volume: 1234 }]);
  assert.equal(new Date(candle.closeTime).toISOString(), "2026-08-25T08:15:00.000Z");
});


test("addStockInstrument posts dynamic symbol to collector", async () => {
  let request;
  const fetchImpl = async (url, options) => { request = { url: String(url), options }; return new Response(JSON.stringify({ ok: true, instrument: { symbol: "VCB" } }), { status: 200 }); };
  const result = await addStockInstrument("vcb", 3, { baseUrl: "http://stocks/", fetchImpl });
  assert.equal(result.instrument.symbol, "VCB");
  assert.equal(request.options.method, "POST");
  assert.deepEqual(JSON.parse(request.options.body), { symbol: "VCB", years: 3 });
});

test("removeStockInstrument deactivates symbol through collector", async () => {
  let request;
  const fetchImpl = async (url, options) => { request = { url: String(url), options }; return new Response(JSON.stringify({ ok: true, historyPreserved: true }), { status: 200 }); };
  const result = await removeStockInstrument("VCB", { baseUrl: "http://stocks/", fetchImpl });
  assert.equal(result.historyPreserved, true);
  assert.equal(request.options.method, "DELETE");
  assert.match(request.url, /admin\/instruments\/VCB$/);
});

test("fetchStockUniverseGroups normalizes collector group contract", async () => {
  const { fetchStockUniverseGroups } = await import("../lib/stocks.js");
  const fetchImpl = async () => new Response(JSON.stringify({ groups: [{ group: "vn30", provider: "ssi", total: 30, preparedCount: 2, missingCount: 28, prepared: [{ symbol: "FPT", exchange: "HOSE", name: "FPT" }, { symbol: "MBB", exchange: "HOSE", name: "MB Bank" }], missing: ["VCB"] }] }), { status: 200 });
  const [row] = await fetchStockUniverseGroups({ baseUrl: "http://stocks/", fetchImpl });
  assert.equal(row.group, "VN30");
  assert.equal(row.total, 30);
  assert.equal(row.preparedCount, 2);
  assert.equal(row.prepared[0].symbol, "FPT");
});

test("syncStockDaily asks collector to sync only requested prepared symbols", async () => {
  let request;
  const fetchImpl = async (url, options) => { request = { url: String(url), options }; return new Response(JSON.stringify({ ok: true, results: [{ symbol: "FPT" }, { symbol: "MBB" }] }), { status: 200 }); };
  const result = await syncStockDaily(["fpt", "MBB", "FPT"], { baseUrl: "http://stocks/", fetchImpl });
  assert.equal(result.results.length, 2);
  assert.equal(request.options.method, "POST");
  assert.match(request.url, /admin\/sync\/daily\?symbols=FPT%2CMBB$/);
});


test("stock prepare classification retries active symbols with incomplete history", () => {
  assert.equal(classifyStockPrepareResult({ backfill: { skipped: true } }, true), "prepared");
  assert.equal(classifyStockPrepareResult({ backfill: { skipped: false } }, true), "retried");
  assert.equal(classifyStockPrepareResult({ backfill: { skipped: false } }, false), "added");
});
