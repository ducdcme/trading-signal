export const SUPPORTED_EXCHANGES = new Set(["BINANCE", "OKX", "BYBIT", "BITGET", "KUCOIN", "GATE", "MEXC"]);
const QUOTES = ["USDT", "USDC"];

function splitQuote(compact) {
  const quote = QUOTES.find(item => compact.endsWith(item));
  return { base: quote ? compact.slice(0, -quote.length) : compact, quote };
}

export function parseInstrument(value, defaultExchange = "AUTO") {
  let input = String(value).trim().toUpperCase();
  if (!input) return null;
  let exchange = defaultExchange;
  if (input.includes(":")) {
    const parts = input.split(":");
    exchange = parts.shift();
    input = parts.join(":");
  }
  if (exchange !== "AUTO" && !SUPPORTED_EXCHANGES.has(exchange)) throw new Error(`Sàn chưa được hỗ trợ: ${exchange}`);
  input = input.replace("/", "-").replace(/[^A-Z0-9-]/g, "");
  if (!input) return null;

  let instrumentId;
  if (exchange === "AUTO") {
    instrumentId = input.replace(/-/g, "");
    instrumentId = splitQuote(instrumentId).base;
    return { exchange, asset: instrumentId, quote: null, instrumentId, key: instrumentId };
  }
  const compact = input.replace(/-/g, "");
  const parts = splitQuote(compact);
  const quote = parts.quote ?? "USDT";
  if (exchange === "OKX" || exchange === "KUCOIN") {
    instrumentId = `${parts.base}-${quote}`;
  } else if (exchange === "GATE") {
    instrumentId = `${parts.base}_${quote}`;
  } else {
    instrumentId = `${parts.base}${quote}`;
  }
  if (!/^[A-Z0-9]+(?:[-_](?:USDT|USDC))?$/.test(instrumentId)) throw new Error(`Mã không hợp lệ: ${value}`);
  return { exchange, asset: parts.base, quote, instrumentId, key: `${exchange}:${instrumentId}` };
}

export function parseInstruments(values, defaultExchange = "AUTO") {
  const found = new Map();
  for (const value of values) {
    const instrument = parseInstrument(value, defaultExchange);
    // Mỗi tài sản chỉ được quét một lần. Mã xuất hiện đầu tiên thắng; AUTO sẽ
    // tự chọn đúng một sàn theo exchangePriority.
    if (instrument && !found.has(instrument.asset)) found.set(instrument.asset, instrument);
  }
  return [...found.values()];
}
