const BASE_URL = "https://api.binance.com";
import { readJsonResponse } from "./http.js";
import { ensureCandles, MarketNotFoundError } from "./exchange-errors.js";

const INTERVALS = { "1H": "1h", "4H": "4h", "1D": "1d" };

export async function fetchBinanceClosedCandles(symbol, timeframe = "1D", limit = 500) {
  const url = new URL("/api/v3/klines", BASE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", INTERVALS[timeframe] || INTERVALS["1D"]);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 100), 1000)));
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  let payload;
  try { payload = await readJsonResponse(response, "Binance"); }
  catch (error) {
    if (/invalid symbol/i.test(error.message)) throw new MarketNotFoundError(`Binance không có cặp Spot ${symbol}`);
    throw error;
  }
  const now = Date.now();
  return ensureCandles(payload
    .filter(row => Number(row[6]) < now)
    .map(row => ({
      openTime: Number(row[0]), open: Number(row[1]), high: Number(row[2]),
      low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]), closeTime: Number(row[6])
    })), "Binance", symbol);
}

export const fetchClosedDailyCandles = (symbol, limit = 500) => fetchBinanceClosedCandles(symbol, "1D", limit);
