import { readJsonResponse } from "./http.js";
import { ensureCandles, MarketNotFoundError } from "./exchange-errors.js";

const BASE_URL = "https://api.kucoin.com";
const INTERVALS = { "1H": ["1hour", 3_600_000], "4H": ["4hour", 14_400_000], "1D": ["1day", 86_400_000] };

export async function fetchKucoinClosedCandles(symbol, timeframe = "1D", limit = 500, includeOpen = false) {
  const [type, duration] = INTERVALS[timeframe] || INTERVALS["1D"];
  const url = new URL("/api/v1/market/candles", BASE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("type", type);
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  let payload;
  try { payload = await readJsonResponse(response, "KuCoin"); }
  catch (error) {
    if (/symbol|exist|400100/i.test(error.message)) throw new MarketNotFoundError(`KuCoin không có cặp Spot ${symbol}`);
    throw error;
  }
  if (payload.code !== "200000") {
    if (/symbol|exist/i.test(payload.msg || "")) throw new MarketNotFoundError(`KuCoin không có cặp Spot ${symbol}`);
    throw new Error(payload.msg || `KuCoin error ${payload.code}`);
  }
  const now = Date.now();
  return ensureCandles((payload.data ?? []).slice(0, Math.min(limit, 1500)).map(row => {
    const openTime = Number(row[0]) * 1000;
    return { openTime, open: Number(row[1]), close: Number(row[2]), high: Number(row[3]), low: Number(row[4]), volume: Number(row[5]), closeTime: openTime + duration - 1 };
  }).filter(item => includeOpen || item.closeTime < now).sort((a, b) => a.openTime - b.openTime), "KuCoin", symbol);
}
