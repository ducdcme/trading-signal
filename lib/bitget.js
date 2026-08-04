import { readJsonResponse } from "./http.js";
import { ensureCandles, MarketNotFoundError } from "./exchange-errors.js";

const BASE_URL = "https://api.bitget.com";
const INTERVALS = { "1H": ["1h", 3_600_000], "4H": ["4h", 14_400_000], "1D": ["1day", 86_400_000] };

export async function fetchBitgetClosedCandles(symbol, timeframe = "1D", limit = 500) {
  const [granularity, duration] = INTERVALS[timeframe] || INTERVALS["1D"];
  const url = new URL("/api/v2/spot/market/candles", BASE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("granularity", granularity);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 100), 1000)));
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const payload = await readJsonResponse(response, "Bitget");
  if (payload.code !== "00000") {
    if (/symbol|parameter/i.test(payload.msg || "")) throw new MarketNotFoundError(`Bitget không có cặp Spot ${symbol}`);
    throw new Error(payload.msg || `Bitget error ${payload.code}`);
  }
  const now = Date.now();
  return ensureCandles((payload.data ?? []).map(row => {
    const openTime = Number(row[0]);
    return { openTime, open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]), closeTime: openTime + duration - 1 };
  }).filter(item => item.closeTime < now).sort((a, b) => a.openTime - b.openTime), "Bitget", symbol);
}
