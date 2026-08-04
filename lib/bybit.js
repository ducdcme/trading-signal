const BASE_URL = "https://api.bybit.com";
import { readJsonResponse } from "./http.js";
import { ensureCandles, MarketNotFoundError } from "./exchange-errors.js";

const INTERVALS = { "1H": ["60", 3_600_000], "4H": ["240", 14_400_000], "1D": ["D", 86_400_000] };

export async function fetchBybitClosedCandles(symbol, timeframe = "1D", limit = 500) {
  const [interval, duration] = INTERVALS[timeframe] || INTERVALS["1D"];
  const url = new URL("/v5/market/kline", BASE_URL);
  url.searchParams.set("category", "spot");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 100), 1000)));
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const payload = await readJsonResponse(response, "Bybit");
  if (payload.retCode !== 0) {
    // Bybit currently uses several messages for an unknown Spot instrument,
    // including the grammatically unusual "Not supported symbols".
    if (/symbol.*invalid|invalid.*symbol|not found|not supported symbols?/i.test(payload.retMsg || "")) {
      throw new MarketNotFoundError(`Bybit không có cặp Spot ${symbol}`);
    }
    throw new Error(payload.retMsg || `Bybit error ${payload.retCode}`);
  }
  const now = Date.now();
  return ensureCandles((payload.result?.list ?? [])
    .map(row => ({
      openTime: Number(row[0]), open: Number(row[1]), high: Number(row[2]),
      low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]),
      closeTime: Number(row[0]) + duration - 1
    }))
    .filter(candle => candle.closeTime < now)
    .sort((a, b) => a.openTime - b.openTime), "Bybit", symbol);
}

export const fetchBybitClosedDailyCandles = (symbol, limit = 500) => fetchBybitClosedCandles(symbol, "1D", limit);
