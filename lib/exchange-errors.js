export class MarketNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "MarketNotFoundError";
  }
}

export function isRetryableExchangeError(error) {
  if (!error || error instanceof MarketNotFoundError) return false;
  if (["AbortError", "TimeoutError"].includes(error.name)) return true;
  const message = String(error.message || error);
  return /(?:timeout|timed out|fetch failed|network|socket|ECONN|EAI_AGAIN|\b429\b|\b5\d\d\b)/i.test(message);
}

export function ensureCandles(candles, exchange, symbol) {
  if (!candles.length) throw new MarketNotFoundError(`${exchange} không có cặp Spot ${symbol}`);
  return candles;
}
