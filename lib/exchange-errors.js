export class MarketNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "MarketNotFoundError";
  }
}

export function ensureCandles(candles, exchange, symbol) {
  if (!candles.length) throw new MarketNotFoundError(`${exchange} không có cặp Spot ${symbol}`);
  return candles;
}
