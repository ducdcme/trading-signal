import { readJsonResponse } from "./http.js";
import { MarketNotFoundError } from "./exchange-errors.js";

const CACHE_MS = 15 * 60_000;
const cache = new Map();

function market(exchange, instrumentId, asset, quote) {
  return { exchange, instrumentId, asset, quote, key: `${exchange}:${instrumentId}` };
}

async function json(url, exchange) {
  return readJsonResponse(await fetch(url, { signal: AbortSignal.timeout(15_000) }), exchange);
}

async function binanceCatalog() {
  const url = new URL("/api/v3/exchangeInfo", "https://api.binance.com");
  url.searchParams.set("symbolStatus", "TRADING");
  const payload = await json(url, "Binance");
  return (payload.symbols ?? [])
    .filter(item => item.status === "TRADING" && item.isSpotTradingAllowed !== false)
    .map(item => market("BINANCE", item.symbol, item.baseAsset, item.quoteAsset));
}

async function okxCatalog() {
  const url = new URL("/api/v5/public/instruments", "https://www.okx.com");
  url.searchParams.set("instType", "SPOT");
  const payload = await json(url, "OKX");
  if (payload.code !== "0") throw new Error(payload.msg || `OKX error ${payload.code}`);
  return (payload.data ?? [])
    .filter(item => item.state === "live")
    .map(item => market("OKX", item.instId, item.baseCcy, item.quoteCcy));
}

async function bybitCatalog() {
  const found = [];
  let cursor = "";
  do {
    const url = new URL("/v5/market/instruments-info", "https://api.bybit.com");
    url.searchParams.set("category", "spot");
    url.searchParams.set("limit", "1000");
    if (cursor) url.searchParams.set("cursor", cursor);
    const payload = await json(url, "Bybit");
    if (payload.retCode !== 0) throw new Error(payload.retMsg || `Bybit error ${payload.retCode}`);
    found.push(...(payload.result?.list ?? [])
      .filter(item => item.status === "Trading")
      .map(item => market("BYBIT", item.symbol, item.baseCoin, item.quoteCoin)));
    cursor = payload.result?.nextPageCursor || "";
  } while (cursor);
  return found;
}

async function bitgetCatalog() {
  const payload = await json("https://api.bitget.com/api/v2/spot/public/symbols", "Bitget");
  if (payload.code !== "00000") throw new Error(payload.msg || `Bitget error ${payload.code}`);
  return (payload.data ?? [])
    .filter(item => String(item.status).toLowerCase() === "online")
    .map(item => market("BITGET", item.symbol, item.baseCoin, item.quoteCoin));
}

async function kucoinCatalog() {
  const payload = await json("https://api.kucoin.com/api/v2/symbols", "KuCoin");
  if (payload.code !== "200000") throw new Error(payload.msg || `KuCoin error ${payload.code}`);
  return (payload.data ?? [])
    .filter(item => item.enableTrading === true)
    .map(item => market("KUCOIN", item.symbol, item.baseCurrency, item.quoteCurrency));
}

async function gateCatalog() {
  const payload = await json("https://api.gateio.ws/api/v4/spot/currency_pairs", "Gate.io");
  return payload
    .filter(item => item.trade_status === "tradable")
    .map(item => market("GATE", item.id, item.base, item.quote));
}

async function mexcCatalog() {
  const payload = await json("https://api.mexc.com/api/v3/exchangeInfo", "MEXC");
  return (payload.symbols ?? [])
    .filter(item => item.isSpotTradingAllowed !== false && ["1", "ENABLED", "TRADING"].includes(String(item.status).toUpperCase()))
    .map(item => market("MEXC", item.symbol, item.baseAsset, item.quoteAsset));
}

const loaders = {
  BINANCE: binanceCatalog,
  OKX: okxCatalog,
  BYBIT: bybitCatalog,
  BITGET: bitgetCatalog,
  KUCOIN: kucoinCatalog,
  GATE: gateCatalog,
  MEXC: mexcCatalog
};

export async function fetchActiveSpotCatalog(exchange, now = Date.now()) {
  const cached = cache.get(exchange);
  if (cached && cached.expiresAt > now) return cached.markets;
  const loader = loaders[exchange];
  if (!loader) throw new Error(`Sàn chưa được hỗ trợ: ${exchange}`);
  const pending = Promise.resolve(loader()).then(items => {
    const markets = new Map(items.map(item => [item.instrumentId, item]));
    cache.set(exchange, { markets, expiresAt: Date.now() + CACHE_MS });
    return markets;
  }).catch(error => {
    cache.delete(exchange);
    throw error;
  });
  cache.set(exchange, { markets: pending, expiresAt: now + CACHE_MS });
  return pending;
}

export async function requireActiveSpotMarket(instrument) {
  const catalog = await fetchActiveSpotCatalog(instrument.exchange);
  const selected = catalog.get(instrument.instrumentId);
  if (!selected) throw new MarketNotFoundError(`${instrument.exchange} không có cặp Spot đang giao dịch ${instrument.instrumentId}`);
  return selected;
}

export function clearMarketCatalogCache() {
  cache.clear();
}
