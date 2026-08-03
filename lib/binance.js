const BASE_URL = "https://api.binance.com";
import { readJsonResponse } from "./http.js";

export async function fetchClosedDailyCandles(symbol, limit = 500) {
  const url = new URL("/api/v3/klines", BASE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 100), 1000)));
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const payload = await readJsonResponse(response, "Binance");
  const now = Date.now();
  return payload
    .filter(row => Number(row[6]) < now)
    .map(row => ({
      openTime: Number(row[0]), open: Number(row[1]), high: Number(row[2]),
      low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]), closeTime: Number(row[6])
    }));
}
