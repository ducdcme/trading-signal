const BASE_URL = "https://www.okx.com";
import { readJsonResponse } from "./http.js";
import { ensureCandles, MarketNotFoundError } from "./exchange-errors.js";

const INTERVALS = { "1H": ["1H", 3_600_000], "4H": ["4H", 14_400_000], "1D": ["1Dutc", 86_400_000] };

export async function fetchOkxClosedCandles(instrumentId, timeframe = "1D", limit = 500) {
  const [bar, duration] = INTERVALS[timeframe] || INTERVALS["1D"];
  const byTimestamp = new Map();
  let after;
  while (byTimestamp.size < limit) {
    const url = new URL("/api/v5/market/history-candles", BASE_URL);
    url.searchParams.set("instId", instrumentId);
    url.searchParams.set("bar", bar);
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const payload = await readJsonResponse(response, "OKX");
    if (payload.code !== "0") {
      if (/instrument.*(?:exist|found|invalid)|instId/i.test(payload.msg || "")) throw new MarketNotFoundError(`OKX không có cặp Spot ${instrumentId}`);
      throw new Error(payload.msg || `OKX error ${payload.code}`);
    }
    const rows = payload.data ?? [];
    if (!rows.length) break;
    for (const row of rows) {
      if (row[8] !== "1") continue;
      const openTime = Number(row[0]);
      byTimestamp.set(openTime, {
        openTime, open: Number(row[1]), high: Number(row[2]), low: Number(row[3]),
        close: Number(row[4]), volume: Number(row[5]), closeTime: openTime + duration - 1
      });
    }
    const oldest = Math.min(...rows.map(row => Number(row[0])));
    if (!Number.isFinite(oldest) || String(oldest) === after) break;
    after = String(oldest);
    if (rows.length < 100) break;
  }
  return ensureCandles([...byTimestamp.values()].sort((a, b) => a.openTime - b.openTime).slice(-limit), "OKX", instrumentId);
}

export const fetchOkxClosedDailyCandles = (symbol, limit = 500) => fetchOkxClosedCandles(symbol, "1D", limit);
