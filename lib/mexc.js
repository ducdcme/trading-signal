import { readJsonResponse } from "./http.js";
import { ensureCandles, MarketNotFoundError } from "./exchange-errors.js";

const BASE_URL = "https://api.mexc.com";
const INTERVALS = { "1H": "60m", "4H": "4h", "1D": "1d" };

export async function fetchMexcClosedCandles(symbol, timeframe = "1D", limit = 500, includeOpen = false) {
  const url = new URL("/api/v3/klines", BASE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", INTERVALS[timeframe] || INTERVALS["1D"]);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 100), 1000)));
  let payload;
  try { payload = await readJsonResponse(await fetch(url, { signal: AbortSignal.timeout(15_000) }), "MEXC"); }
  catch (error) {
    if (/invalid symbol|symbol not found/i.test(error.message)) throw new MarketNotFoundError(`MEXC không có cặp Spot ${symbol}`);
    throw error;
  }
  const now = Date.now();
  return ensureCandles(payload.filter(row => includeOpen || Number(row[6]) < now).map(row => ({ openTime: Number(row[0]), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]), closeTime: Number(row[6]) })), "MEXC", symbol);
}
