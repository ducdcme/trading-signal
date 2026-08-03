const SUPPORTED_EXCHANGES = new Set(["BINANCE", "BYBIT", "OKX"]);
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
    return { exchange, instrumentId, key: instrumentId };
  }
  const compact = input.replace(/-/g, "");
  const parts = splitQuote(compact);
  const quote = parts.quote ?? "USDT";
  if (exchange === "OKX") {
    instrumentId = `${parts.base}-${quote}`;
  } else {
    instrumentId = `${parts.base}${quote}`;
  }
  if (!/^[A-Z0-9]+(?:-(?:USDT|USDC))?$/.test(instrumentId)) throw new Error(`Mã không hợp lệ: ${value}`);
  return { exchange, instrumentId, key: `${exchange}:${instrumentId}` };
}

export function parseInstruments(values, defaultExchange = "AUTO") {
  const found = new Map();
  for (const value of values) {
    const instrument = parseInstrument(value, defaultExchange);
    if (instrument) found.set(instrument.key, instrument);
  }
  return [...found.values()];
}
