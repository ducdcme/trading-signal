const BASE_URL = "https://www.okx.com";
const DAY_MS = 86_400_000;
import { readJsonResponse } from "./http.js";

export async function fetchOkxClosedDailyCandles(instrumentId, limit = 500) {
  const byTimestamp = new Map();
  let after;
  while (byTimestamp.size < limit) {
    const url = new URL("/api/v5/market/history-candles", BASE_URL);
    url.searchParams.set("instId", instrumentId);
    url.searchParams.set("bar", "1Dutc");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const payload = await readJsonResponse(response, "OKX");
    if (payload.code !== "0") throw new Error(payload.msg || `OKX error ${payload.code}`);
    const rows = payload.data ?? [];
    if (!rows.length) break;
    for (const row of rows) {
      if (row[8] !== "1") continue;
      const openTime = Number(row[0]);
      byTimestamp.set(openTime, {
        openTime, open: Number(row[1]), high: Number(row[2]), low: Number(row[3]),
        close: Number(row[4]), volume: Number(row[5]), closeTime: openTime + DAY_MS - 1
      });
    }
    const oldest = Math.min(...rows.map(row => Number(row[0])));
    if (!Number.isFinite(oldest) || String(oldest) === after) break;
    after = String(oldest);
    if (rows.length < 100) break;
  }
  return [...byTimestamp.values()].sort((a, b) => a.openTime - b.openTime).slice(-limit);
}
