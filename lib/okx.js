const BASE_URL = "https://www.okx.com";
import { readJsonResponse } from "./http.js";
import { ensureCandles, MarketNotFoundError } from "./exchange-errors.js";

const INTERVALS = { "1H": ["1H", 3_600_000], "4H": ["4H", 14_400_000], "1D": ["1Dutc", 86_400_000] };
const MIN_REQUEST_INTERVAL_MS = 120;
const MAX_RATE_LIMIT_RETRIES = 3;
let requestQueue = Promise.resolve();
let nextRequestAt = 0;

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function queuedFetch(url) {
  const request = requestQueue.then(async () => {
    const wait = Math.max(0, nextRequestAt - Date.now());
    if (wait) await sleep(wait);
    nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
    return fetch(url, { signal: AbortSignal.timeout(15_000) });
  });
  requestQueue = request.then(() => undefined, () => undefined);
  return request;
}

async function fetchOkxPayload(url) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await queuedFetch(url);
    try {
      return await readJsonResponse(response, "OKX");
    } catch (error) {
      if (response.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) throw error;
      const retryAfterSeconds = Number(response.headers?.get?.("retry-after"));
      const retryDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : 500 * (2 ** attempt);
      await sleep(retryDelay);
    }
  }
}

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
    const payload = await fetchOkxPayload(url);
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
