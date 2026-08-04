import { readJsonResponse } from "./http.js";
import { ensureCandles, MarketNotFoundError } from "./exchange-errors.js";

const BASE_URL = "https://api.gateio.ws";
const INTERVALS = { "1H": ["1h", 3_600_000], "4H": ["4h", 14_400_000], "1D": ["1d", 86_400_000] };

export async function fetchGateClosedCandles(symbol, timeframe = "1D", limit = 500) {
  const [interval, duration] = INTERVALS[timeframe] || INTERVALS["1D"];
  const url = new URL("/api/v4/spot/candlesticks", BASE_URL);
  url.searchParams.set("currency_pair", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 100), 1000)));
  let payload;
  try { payload = await readJsonResponse(await fetch(url, { signal: AbortSignal.timeout(15_000) }), "Gate.io"); }
  catch (error) {
    if (/currency_pair|invalid.*pair/i.test(error.message)) throw new MarketNotFoundError(`Gate.io không có cặp Spot ${symbol}`);
    throw error;
  }
  const now = Date.now();
  return ensureCandles(payload.map(row => {
    const openTime = Number(row[0]) * 1000;
    return { openTime, open: Number(row[5]), high: Number(row[3]), low: Number(row[4]), close: Number(row[2]), volume: Number(row[6] ?? row[1]), closeTime: openTime + duration - 1 };
  }).filter(item => item.closeTime < now).sort((a, b) => a.openTime - b.openTime), "Gate.io", symbol);
}
