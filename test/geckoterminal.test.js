import test from "node:test";
import assert from "node:assert/strict";
import { discoverDexPoolOptions, fetchDexCandles, poolOptions, resetGeckoTerminalStateForTests, selectBestPool, selectPinnedPool } from "../lib/geckoterminal.js";

const tokenId = "base_0xtoken";
const pool = (address, quoteId, liquidity) => ({
  attributes: { address, reserve_in_usd: String(liquidity) },
  relationships: { base_token: { data: { id: tokenId } }, quote_token: { data: { id: quoteId } } }
});
const included = [
  { id: "base_usdt", type: "token", attributes: { symbol: "USDT" } },
  { id: "base_usdc", type: "token", attributes: { symbol: "USDC" } },
  { id: "base_weth", type: "token", attributes: { symbol: "WETH" } }
];

test("selects the most liquid eligible pool regardless of quote token", () => {
  const selected = selectBestPool([pool("usdc-pool", "base_usdc", 2_000_000), pool("usdt-pool", "base_usdt", 500_000)], "0xtoken", 10_000, included);
  assert.equal(selected.pool.attributes.address, "usdc-pool");
  assert.equal(selected.quoteSymbol, "USDC");
});

test("supports a non-stable quote pool", () => {
  const selected = selectBestPool([pool("usdc-pool", "base_usdc", 300_000), pool("other", "base_weth", 9_000_000)], "0xtoken", 10_000, included);
  assert.equal(selected.pool.attributes.address, "other");
  assert.equal(selected.quoteSymbol, "WETH");
});

test("keeps an explicitly pinned pool even when another pool is more liquid", () => {
  const pools = [pool("pinned-pool", "base_usdc", 80_000), pool("best-pool", "base_usdt", 900_000)];
  const selected = selectPinnedPool(pools, "0xtoken", "PINNED-POOL", included);
  assert.equal(selected.pool.attributes.address, "pinned-pool");
  assert.equal(selected.liquidity, 80_000);
  assert.equal(selected.quoteSymbol, "USDC");
});

test("returns pool information for manual choice and marks low liquidity", () => {
  const options = poolOptions([pool("low", "base_weth", 8_000), pool("eligible", "base_usdt", 12_000)], "0xtoken", included, 10_000);
  assert.deepEqual(options.map(item => [item.poolAddress, item.quoteSymbol, item.meetsMinimumLiquidity]), [
    ["eligible", "USDT", true],
    ["low", "WETH", false]
  ]);
});

test("rejects a pinned pool that does not belong to the token", () => {
  const unrelated = pool("other-pool", "base_usdt", 900_000);
  unrelated.relationships.base_token.data.id = "base_0xother";
  assert.equal(selectPinnedPool([unrelated], "0xtoken", "other-pool", included), null);
});

const apiOptions = { poolPages: 1, requestIntervalMs: 0, rateLimitRetries: 1, retryBaseMs: 1, poolCacheMinutes: 30, minimumLiquidityUsd: 10_000 };
const poolPayload = { data: [pool("cached-pool", "base_weth", 25_000)], included };

test("caches pool discovery so search, scan and chart can reuse one API response", async t => {
  resetGeckoTerminalStateForTests();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify(poolPayload), { status: 200, headers: { "content-type": "application/json" } }); };
  t.after(() => { globalThis.fetch = originalFetch; resetGeckoTerminalStateForTests(); });
  await discoverDexPoolOptions({ network: "base", tokenAddress: "0xtoken" }, apiOptions);
  await discoverDexPoolOptions({ network: "base", tokenAddress: "0xtoken" }, apiOptions);
  assert.equal(calls, 1);
});

test("retries a GeckoTerminal 429 response with backoff", async t => {
  resetGeckoTerminalStateForTests();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? new Response(JSON.stringify({ message: "Too Many Requests" }), { status: 429, headers: { "content-type": "application/json", "retry-after": "0" } })
      : new Response(JSON.stringify(poolPayload), { status: 200, headers: { "content-type": "application/json" } });
  };
  t.after(() => { globalThis.fetch = originalFetch; resetGeckoTerminalStateForTests(); });
  const options = await discoverDexPoolOptions({ network: "base", tokenAddress: "0xtoken" }, apiOptions);
  assert.equal(calls, 2);
  assert.equal(options[0].poolAddress, "cached-pool");
});

test("retries a transient fetch failure before returning pool options", async t => {
  resetGeckoTerminalStateForTests();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    return new Response(JSON.stringify(poolPayload), { status: 200, headers: { "content-type": "application/json" } });
  };
  t.after(() => { globalThis.fetch = originalFetch; resetGeckoTerminalStateForTests(); });
  const options = await discoverDexPoolOptions({ network: "base", tokenAddress: "0xtoken" }, apiOptions);
  assert.equal(calls, 2);
  assert.equal(options[0].poolAddress, "cached-pool");
});

test("reuses stale candles when a refresh temporarily fails", async t => {
  resetGeckoTerminalStateForTests();
  const originalFetch = globalThis.fetch;
  let now = 1_000_000;
  const originalNow = Date.now;
  Date.now = () => now;
  let failRefresh = false;
  const ohlcvPayload = {
    data: { attributes: { ohlcv_list: [[900, 1, 2, 0.5, 1.5, 100], [800, 1, 2, 0.5, 1.4, 90]] } },
    meta: { base: { symbol: "TEST" } }
  };
  globalThis.fetch = async url => {
    if (String(url).includes("/ohlcv/")) {
      if (failRefresh) throw new TypeError("fetch failed");
      return new Response(JSON.stringify(ohlcvPayload), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify(poolPayload), { status: 200, headers: { "content-type": "application/json" } });
  };
  t.after(() => { globalThis.fetch = originalFetch; Date.now = originalNow; resetGeckoTerminalStateForTests(); });
  const options = { ...apiOptions, rateLimitRetries: 0, cacheMinutes: 1 };
  await fetchDexCandles({ network: "base", tokenAddress: "0xtoken", poolAddress: "cached-pool" }, "1H", options, 1, true);
  now += 61_000;
  failRefresh = true;
  const market = await fetchDexCandles({ network: "base", tokenAddress: "0xtoken", poolAddress: "cached-pool" }, "1H", options, 1, true);
  assert.equal(market.candles.length, 2);
  assert.match(market.warnings.join(" "), /cache gần nhất/);
});
