const BASE_URL = "https://api.bybit.com";
const DAY_MS = 86_400_000;
import { readJsonResponse } from "./http.js";

export async function fetchBybitClosedDailyCandles(symbol, limit = 500) {
  const url = new URL("/v5/market/kline", BASE_URL);
  url.searchParams.set("category", "spot");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", "D");
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 100), 1000)));
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const payload = await readJsonResponse(response, "Bybit");
  if (payload.retCode !== 0) throw new Error(payload.retMsg || `Bybit error ${payload.retCode}`);
  const now = Date.now();
  return (payload.result?.list ?? [])
    .map(row => ({
      openTime: Number(row[0]), open: Number(row[1]), high: Number(row[2]),
      low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]),
      closeTime: Number(row[0]) + DAY_MS - 1
    }))
    .filter(candle => candle.closeTime < now)
    .sort((a, b) => a.openTime - b.openTime);
}
