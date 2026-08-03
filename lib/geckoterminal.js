import { readJsonResponse } from "./http.js";

const KEYLESS_BASE_URL = "https://api.geckoterminal.com/api/v2";
const PRO_BASE_URL = "https://pro-api.coingecko.com/api/v3/onchain";
const DAY_MS = 86_400_000;
const cache = new Map();
let requestQueue = Promise.resolve();
let nextRequestAt = 0;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function limitedJson(url, intervalMs, apiKey) {
  const task = requestQueue.then(async () => {
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay) await wait(delay);
    nextRequestAt = Date.now() + intervalMs;
    const headers = { accept: "application/json" };
    if (apiKey) headers["x-cg-pro-api-key"] = apiKey;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    return readJsonResponse(response, "GeckoTerminal");
  });
  requestQueue = task.catch(() => {});
  return task;
}

function relationshipAddress(pool, side) {
  return pool.relationships?.[`${side}_token`]?.data?.id ?? "";
}

function tokenSide(pool, tokenAddress) {
  const suffix = `_${tokenAddress}`.toLowerCase();
  if (relationshipAddress(pool, "base").toLowerCase().endsWith(suffix)) return "base";
  if (relationshipAddress(pool, "quote").toLowerCase().endsWith(suffix)) return "quote";
  return null;
}

function includedSymbols(included = []) {
  return new Map(included.filter(item => item.type === "token").map(item => [item.id, String(item.attributes?.symbol ?? "").toUpperCase()]));
}

export function selectBestPool(pools, tokenAddress, minimumLiquidityUsd, included = [], quotePriority = ["USDT", "USDC"]) {
  const symbols = includedSymbols(included);
  return pools
    .map(pool => {
      const side = tokenSide(pool, tokenAddress);
      const counterpartId = side === "base" ? relationshipAddress(pool, "quote") : relationshipAddress(pool, "base");
      const quoteSymbol = symbols.get(counterpartId) ?? "";
      return { pool, side, quoteSymbol, quoteRank: quotePriority.indexOf(quoteSymbol), liquidity: Number(pool.attributes?.reserve_in_usd ?? 0) };
    })
    .filter(item => item.side && item.quoteRank >= 0 && item.liquidity >= minimumLiquidityUsd)
    .sort((a, b) => a.quoteRank - b.quoteRank || b.liquidity - a.liquidity)[0] ?? null;
}

export async function fetchDexDailyCandles({ network, tokenAddress }, options, requiredDailyCandles = 500) {
  const baseUrl = options.apiKey ? PRO_BASE_URL : KEYLESS_BASE_URL;
  const cacheKey = `${options.apiKey ? "pro" : "keyless"}:${network}:${tokenAddress}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && cached.value.candles.length >= requiredDailyCandles) return cached.value;

  const pools = [];
  const included = new Map();
  for (let page = 1; page <= options.poolPages; page += 1) {
    const poolsUrl = new URL(`${baseUrl}/networks/${encodeURIComponent(network)}/tokens/${encodeURIComponent(tokenAddress)}/pools`);
    poolsUrl.searchParams.set("page", String(page));
    poolsUrl.searchParams.set("include", "base_token,quote_token");
    const poolsPayload = await limitedJson(poolsUrl, options.requestIntervalMs, options.apiKey);
    const pagePools = poolsPayload.data ?? [];
    pools.push(...pagePools);
    for (const item of poolsPayload.included ?? []) included.set(item.id, item);
    if (!pagePools.length) break;
  }
  const selected = selectBestPool(pools, tokenAddress, options.minimumLiquidityUsd, [...included.values()], options.quotePriority);
  if (!selected) throw new Error(`Không có pool USDT/USDC thanh khoản từ ${options.minimumLiquidityUsd.toLocaleString("en-US")} USD trở lên`);

  const poolAddress = selected.pool.attributes.address;
  const byTimestamp = new Map();
  let beforeTimestamp;
  let meta;
  while (byTimestamp.size < requiredDailyCandles) {
    const ohlcvUrl = new URL(`${baseUrl}/networks/${encodeURIComponent(network)}/pools/${encodeURIComponent(poolAddress)}/ohlcv/day`);
    ohlcvUrl.searchParams.set("token", selected.side);
    ohlcvUrl.searchParams.set("aggregate", "1");
    ohlcvUrl.searchParams.set("limit", "1000");
    ohlcvUrl.searchParams.set("currency", "usd");
    ohlcvUrl.searchParams.set("include_empty_intervals", "true");
    if (beforeTimestamp) ohlcvUrl.searchParams.set("before_timestamp", beforeTimestamp);
    const ohlcvPayload = await limitedJson(ohlcvUrl, options.requestIntervalMs, options.apiKey);
    meta ??= ohlcvPayload.meta;
    const rows = ohlcvPayload.data?.attributes?.ohlcv_list ?? [];
    if (!rows.length) break;
    for (const row of rows) byTimestamp.set(Number(row[0]), row);
    const oldest = Math.min(...rows.map(row => Number(row[0])));
    if (!Number.isFinite(oldest) || String(oldest) === beforeTimestamp) break;
    beforeTimestamp = String(oldest);
    if (!options.apiKey) break;
  }
  const now = Date.now();
  const candles = [...byTimestamp.values()]
    .map(row => ({
      openTime: Number(row[0]) * 1000, open: Number(row[1]), high: Number(row[2]), low: Number(row[3]),
      close: Number(row[4]), volume: Number(row[5]), closeTime: Number(row[0]) * 1000 + DAY_MS - 1
    }))
    .filter(candle => candle.closeTime < now)
    .sort((a, b) => a.openTime - b.openTime);
  const value = {
    candles,
    network,
    tokenAddress,
    poolAddress,
    poolName: selected.pool.attributes.name,
    dex: selected.pool.relationships?.dex?.data?.id ?? "unknown",
    liquidityUsd: selected.liquidity,
    quoteSymbol: selected.quoteSymbol,
    tokenSymbol: meta?.base?.symbol ?? "TOKEN"
  };
  cache.set(cacheKey, { expiresAt: Date.now() + options.cacheMinutes * 60_000, value });
  return value;
}
