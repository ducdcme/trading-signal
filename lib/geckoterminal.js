import { readJsonResponse } from "./http.js";

const KEYLESS_BASE_URL = "https://api.geckoterminal.com/api/v2";
const PRO_BASE_URL = "https://pro-api.coingecko.com/api/v3/onchain";
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const cache = new Map();
const poolCache = new Map();
const poolRequests = new Map();
const candleRequests = new Map();
let requestQueue = Promise.resolve();
let nextRequestAt = 0;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export function resetGeckoTerminalStateForTests() {
  cache.clear();
  poolCache.clear();
  poolRequests.clear();
  candleRequests.clear();
  requestQueue = Promise.resolve();
  nextRequestAt = 0;
}

function retryAfterMs(response) {
  const value = response.headers.get("retry-after");
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : 0;
}

function limitedJson(url, options) {
  const task = requestQueue.then(async () => {
    const retries = Math.max(0, Number(options.rateLimitRetries) || 0);
    for (let attempt = 0; ; attempt += 1) {
      const delay = Math.max(0, nextRequestAt - Date.now());
      if (delay) await wait(delay);
      nextRequestAt = Date.now() + Math.max(0, Number(options.requestIntervalMs) || 0);
      const headers = { accept: "application/json" };
      if (options.apiKey) headers["x-cg-pro-api-key"] = options.apiKey;
      let response;
      try {
        response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
      } catch (error) {
        if (attempt >= retries) {
          const detail = error?.name === "TimeoutError" || error?.name === "AbortError" ? "quá thời gian chờ" : "kết nối thất bại";
          throw new Error(`GeckoTerminal ${detail} sau ${attempt + 1} lần thử`);
        }
        await wait((Number(options.retryBaseMs) || 10_000) * (attempt + 1));
        continue;
      }
      const retriable = response.status === 429 || response.status >= 500;
      if (!retriable || attempt >= retries) return readJsonResponse(response, "GeckoTerminal");
      const backoff = Math.max(Number(options.retryBaseMs) || 10_000, retryAfterMs(response));
      await response.text();
      await wait(backoff * (attempt + 1));
    }
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

function poolDetails(pool, tokenAddress, symbols) {
  const side = tokenSide(pool, tokenAddress);
  const counterpartId = side === "base" ? relationshipAddress(pool, "quote") : relationshipAddress(pool, "base");
  const quoteSymbol = symbols.get(counterpartId) ?? "";
  return {
    pool,
    side,
    quoteSymbol,
    liquidity: Number(pool.attributes?.reserve_in_usd ?? 0),
    volume24h: Number(pool.attributes?.volume_usd?.h24 ?? 0)
  };
}

export function selectBestPool(pools, tokenAddress, minimumLiquidityUsd, included = []) {
  const symbols = includedSymbols(included);
  return pools
    .map(pool => poolDetails(pool, tokenAddress, symbols))
    .filter(item => item.side && item.liquidity >= minimumLiquidityUsd)
    .sort((a, b) => b.liquidity - a.liquidity || b.volume24h - a.volume24h)[0] ?? null;
}

export function selectPinnedPool(pools, tokenAddress, poolAddress, included = []) {
  if (!poolAddress) return null;
  const symbols = includedSymbols(included);
  const normalized = poolAddress.toLowerCase();
  const pool = pools.find(item => String(item.attributes?.address ?? "").toLowerCase() === normalized);
  if (!pool) return null;
  const selected = poolDetails(pool, tokenAddress, symbols);
  return selected.side ? selected : null;
}

export function poolOptions(pools, tokenAddress, included = [], minimumLiquidityUsd = 0) {
  const symbols = includedSymbols(included);
  return pools
    .map(pool => poolDetails(pool, tokenAddress, symbols))
    .filter(item => item.side)
    .sort((a, b) => b.liquidity - a.liquidity || b.volume24h - a.volume24h)
    .map(item => ({
      poolAddress: item.pool.attributes?.address ?? "",
      poolName: item.pool.attributes?.name ?? "",
      dex: item.pool.relationships?.dex?.data?.id ?? "unknown",
      quoteSymbol: item.quoteSymbol || "—",
      liquidityUsd: item.liquidity,
      volume24hUsd: item.volume24h,
      meetsMinimumLiquidity: item.liquidity >= minimumLiquidityUsd
    }));
}

function ohlcvSource(timeframe) {
  if (timeframe === "1H") return { period: "hour", aggregate: "1", durationMs: HOUR_MS };
  if (timeframe === "4H" || timeframe === "8H") return { period: "hour", aggregate: "4", durationMs: 4 * HOUR_MS };
  return { period: "day", aggregate: "1", durationMs: DAY_MS };
}

async function discoverPools(network, tokenAddress, options, baseUrl) {
  const cacheKey = `${options.apiKey ? "pro" : "keyless"}:${network}:${tokenAddress.toLowerCase()}:${options.poolPages}`;
  const cached = poolCache.get(cacheKey);
  if (cached?.expiresAt > Date.now()) return cached.value;
  if (poolRequests.has(cacheKey)) return poolRequests.get(cacheKey);
  const request = (async () => {
    const pools = [];
    const included = new Map();
    for (let page = 1; page <= options.poolPages; page += 1) {
      const url = new URL(`${baseUrl}/networks/${encodeURIComponent(network)}/tokens/${encodeURIComponent(tokenAddress)}/pools`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("include", "base_token,quote_token");
      const payload = await limitedJson(url, options);
      const pagePools = payload.data ?? [];
      pools.push(...pagePools);
      for (const item of payload.included ?? []) included.set(item.id, item);
      if (!pagePools.length) break;
    }
    const value = { pools, included: [...included.values()] };
    const minutes = Math.max(1, Number(options.poolCacheMinutes) || Number(options.cacheMinutes) || 10);
    poolCache.set(cacheKey, { expiresAt: Date.now() + minutes * 60_000, value });
    return value;
  })();
  poolRequests.set(cacheKey, request);
  try { return await request; }
  finally { poolRequests.delete(cacheKey); }
}

export async function discoverDexPoolOptions({ network, tokenAddress }, options) {
  const baseUrl = options.apiKey ? PRO_BASE_URL : KEYLESS_BASE_URL;
  const { pools, included } = await discoverPools(network, tokenAddress, options, baseUrl);
  return poolOptions(pools, tokenAddress, included, Number(options.minimumLiquidityUsd) || 0);
}

export async function fetchDexCandles({ network, tokenAddress, poolAddress = "" }, timeframe, options, requiredCandles = 100, includeOpen = false) {
  const baseUrl = options.apiKey ? PRO_BASE_URL : KEYLESS_BASE_URL;
  const { pools, included } = await discoverPools(network, tokenAddress, options, baseUrl);
  const best = selectBestPool(pools, tokenAddress, options.minimumLiquidityUsd, included);
  const pinned = poolAddress ? selectPinnedPool(pools, tokenAddress, poolAddress, included) : null;
  if (poolAddress && !pinned) throw new Error(`Pool ghim không thuộc token hoặc không còn được GeckoTerminal trả về: ${poolAddress}`);
  const selected = pinned || best;
  if (!selected) throw new Error(`Không có pool thanh khoản từ ${options.minimumLiquidityUsd.toLocaleString("en-US")} USD trở lên; hãy tìm pool và chọn thủ công nếu vẫn muốn dùng pool thanh khoản thấp hơn`);

  const selectedAddress = selected.pool.attributes.address;
  const source = ohlcvSource(timeframe);
  const requiredSourceCandles = timeframe === "8H" ? requiredCandles * 2 : timeframe === "1W" ? requiredCandles * 7 : requiredCandles;
  const cacheKey = `${options.apiKey ? "pro" : "keyless"}:${network}:${tokenAddress}:${selectedAddress}:${source.period}:${source.aggregate}`;
  const cached = cache.get(cacheKey);
  let value = cached?.value;
  let staleCacheUsed = false;
  if (!value || cached.expiresAt <= Date.now() || value.candles.length < requiredSourceCandles) {
    if (candleRequests.has(cacheKey)) {
      try { await candleRequests.get(cacheKey); } catch { /* lượt gọi bên dưới sẽ retry hoặc dùng cache cũ */ }
      value = cache.get(cacheKey)?.value;
    }
  }
  if (!value || cache.get(cacheKey)?.expiresAt <= Date.now() || value.candles.length < requiredSourceCandles) {
    const staleValue = value;
    const request = (async () => {
    const byTimestamp = new Map();
    let beforeTimestamp;
    let meta;
    while (byTimestamp.size < requiredSourceCandles) {
      const url = new URL(`${baseUrl}/networks/${encodeURIComponent(network)}/pools/${encodeURIComponent(selectedAddress)}/ohlcv/${source.period}`);
      url.searchParams.set("token", selected.side);
      url.searchParams.set("aggregate", source.aggregate);
      url.searchParams.set("limit", "1000");
      url.searchParams.set("currency", "usd");
      url.searchParams.set("include_empty_intervals", "true");
      if (beforeTimestamp) url.searchParams.set("before_timestamp", beforeTimestamp);
      const payload = await limitedJson(url, options);
      meta ??= payload.meta;
      const rows = payload.data?.attributes?.ohlcv_list ?? [];
      if (!rows.length) break;
      for (const row of rows) byTimestamp.set(Number(row[0]), row);
      const oldest = Math.min(...rows.map(row => Number(row[0])));
      if (!Number.isFinite(oldest) || String(oldest) === beforeTimestamp) break;
      beforeTimestamp = String(oldest);
      if (!options.apiKey) break;
    }
    const freshValue = {
      candles: [...byTimestamp.values()].map(row => ({
        openTime: Number(row[0]) * 1000,
        open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]),
        closeTime: Number(row[0]) * 1000 + source.durationMs - 1
      })).sort((a, b) => a.openTime - b.openTime),
      tokenSymbol: meta?.[selected.side]?.symbol ?? "TOKEN"
    };
    cache.set(cacheKey, { expiresAt: Date.now() + options.cacheMinutes * 60_000, value: freshValue });
    return freshValue;
    })();
    candleRequests.set(cacheKey, request);
    try { value = await request; }
    catch (error) {
      if (!staleValue || staleValue.candles.length < requiredSourceCandles) throw error;
      value = staleValue;
      staleCacheUsed = true;
    } finally {
      if (candleRequests.get(cacheKey) === request) candleRequests.delete(cacheKey);
    }
  }

  const warnings = [];
  if (staleCacheUsed) warnings.push("Nguồn DEX tạm chập chờn; đang dùng dữ liệu nến cache gần nhất");
  if (pinned && selected.liquidity < options.minimumLiquidityUsd) warnings.push(`Pool ghim có thanh khoản thấp: $${Math.round(selected.liquidity).toLocaleString("en-US")}`);
  const switchRatio = Number(options.poolSwitchLiquidityRatio) || 1.5;
  if (pinned && best && best.pool.attributes.address.toLowerCase() !== selectedAddress.toLowerCase() && best.liquidity >= selected.liquidity * switchRatio) {
    warnings.push(`Có pool đề xuất thanh khoản tốt hơn: ${best.pool.attributes.name || best.pool.attributes.address}`);
  }
  const now = Date.now();
  return {
    candles: value.candles.filter(candle => includeOpen || candle.closeTime < now),
    network,
    tokenAddress,
    poolAddress: selectedAddress,
    poolName: selected.pool.attributes.name,
    dex: selected.pool.relationships?.dex?.data?.id ?? "unknown",
    liquidityUsd: selected.liquidity,
    quoteSymbol: selected.quoteSymbol,
    tokenSymbol: value.tokenSymbol,
    poolPinned: Boolean(pinned),
    suggestedPoolAddress: best?.pool.attributes.address ?? selectedAddress,
    warnings
  };
}

export function fetchDexDailyCandles(token, options, requiredDailyCandles = 500) {
  return fetchDexCandles(token, "1D", options, requiredDailyCandles, false);
}
