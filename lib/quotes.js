import { parseInstrument } from "./instruments.js";
import { resolveAndFetchClosedCandles } from "./market.js";

const QUOTE_CACHE_MS = 15_000;
const cache = new Map();

function quoteFromCandles(instrument, candles, now = Date.now()) {
  const current = candles.at(-1);
  if (!current) throw new Error("Không có dữ liệu giá");
  const currentIsOpen = current.closeTime >= now;
  const previous = currentIsOpen ? candles.at(-2) : candles.at(-2);
  if (!previous) throw new Error("Không đủ dữ liệu để tính thay đổi D1");
  const price = Number(current.close);
  const previousClose = Number(previous.close);
  const changePercent = previousClose ? (price - previousClose) / previousClose * 100 : 0;
  return {
    asset: instrument.asset,
    exchange: instrument.exchange,
    instrumentId: instrument.instrumentId,
    quote: instrument.quote,
    price,
    previousClose,
    changePercent,
    asOf: Number(current.openTime),
    isLive: currentIsOpen
  };
}

export async function fetchMarketQuote(value, options = {}) {
  const now = options.now ?? Date.now();
  const parsed = typeof value === "string" ? parseInstrument(value) : value;
  if (!parsed) throw new Error("Mã coin không hợp lệ");
  const cacheKey = parsed.key;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.quote;
  const resolved = await resolveAndFetchClosedCandles(
    parsed,
    "1D",
    100,
    options.exchangePriority,
    options.quotePriority,
    true
  );
  const quote = quoteFromCandles(resolved.instrument, resolved.candles, now);
  cache.set(cacheKey, { quote, expiresAt: now + QUOTE_CACHE_MS });
  cache.set(resolved.instrument.key, { quote, expiresAt: now + QUOTE_CACHE_MS });
  return quote;
}

export function clearQuoteCache() {
  cache.clear();
}

export { quoteFromCandles };
