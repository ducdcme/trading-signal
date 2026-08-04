import { fetchBinanceClosedCandles } from "./binance.js";
import { fetchBybitClosedCandles } from "./bybit.js";
import { fetchOkxClosedCandles } from "./okx.js";
import { fetchBitgetClosedCandles } from "./bitget.js";
import { fetchKucoinClosedCandles } from "./kucoin.js";
import { fetchGateClosedCandles } from "./gate.js";
import { fetchMexcClosedCandles } from "./mexc.js";
import { parseInstrument } from "./instruments.js";
import { MarketNotFoundError } from "./exchange-errors.js";
import { fetchActiveSpotCatalog, requireActiveSpotMarket } from "./market-catalog.js";

const TIMEFRAME_MS = { "1H": 3_600_000, "4H": 14_400_000, "1D": 86_400_000 };

export function ensureFreshCandles(candles, timeframe, exchange, symbol, now = Date.now()) {
  const duration = TIMEFRAME_MS[timeframe] || TIMEFRAME_MS["1D"];
  const lastClose = candles.at(-1)?.closeTime;
  if (!Number.isFinite(lastClose) || now - lastClose > duration * 2) {
    const date = Number.isFinite(lastClose) ? new Date(lastClose).toISOString().slice(0, 10) : "không xác định";
    throw new MarketNotFoundError(`${exchange} ${symbol} không có nến ${timeframe} mới; nến cuối ${date}`);
  }
  return candles;
}

async function fetchCandlesFromExchange(instrument, timeframe, limit) {
  switch (instrument.exchange) {
    case "BINANCE": return fetchBinanceClosedCandles(instrument.instrumentId, timeframe, limit);
    case "OKX": return fetchOkxClosedCandles(instrument.instrumentId, timeframe, limit);
    case "BYBIT": return fetchBybitClosedCandles(instrument.instrumentId, timeframe, limit);
    case "BITGET": return fetchBitgetClosedCandles(instrument.instrumentId, timeframe, limit);
    case "KUCOIN": return fetchKucoinClosedCandles(instrument.instrumentId, timeframe, limit);
    case "GATE": return fetchGateClosedCandles(instrument.instrumentId, timeframe, limit);
    case "MEXC": return fetchMexcClosedCandles(instrument.instrumentId, timeframe, limit);
    default: throw new Error(`Sàn chưa được hỗ trợ: ${instrument.exchange}`);
  }
}

export async function fetchFromExchange(instrument, timeframe, limit) {
  const active = await requireActiveSpotMarket(instrument);
  const candles = await fetchCandlesFromExchange(active, timeframe, limit);
  return ensureFreshCandles(candles, timeframe, active.exchange, active.instrumentId);
}

export async function resolveAndFetchClosedCandles(instrument, timeframe, limit, priority = ["BINANCE", "OKX", "BYBIT", "BITGET", "KUCOIN", "GATE", "MEXC"], quotePriority = ["USDT", "USDC", "FDUSD"]) {
  if (instrument.exchange !== "AUTO") {
    return { instrument, candles: await fetchFromExchange(instrument, timeframe, limit) };
  }
  const failures = [];
  for (const exchange of priority) {
    let catalog;
    try {
      catalog = await fetchActiveSpotCatalog(exchange);
    } catch (error) {
      throw new Error(`${exchange} API lỗi; giữ nguyên thứ tự ưu tiên và không tự chuyển sàn: ${error.message}`);
    }
    const exchangeQuotes = exchange === "BINANCE" ? quotePriority : quotePriority.filter(quote => quote !== "FDUSD");
    for (const quote of exchangeQuotes) {
      const candidate = parseInstrument(`${exchange}:${instrument.instrumentId}${quote}`);
      const active = catalog.get(candidate.instrumentId);
      if (!active) {
        failures.push(`${exchange}/${quote}`);
        continue;
      }
      try {
        const candles = await fetchCandlesFromExchange(active, timeframe, limit);
        return { instrument: active, candles: ensureFreshCandles(candles, timeframe, active.exchange, active.instrumentId) };
      } catch (error) {
        if (!(error instanceof MarketNotFoundError)) throw new Error(`${exchange} API lỗi; giữ nguyên thứ tự ưu tiên và không tự chuyển sàn: ${error.message}`);
        failures.push(`${exchange}/${quote}: ${error.message}`);
      }
    }
  }
  throw new MarketNotFoundError(`Không tìm thấy cặp Spot đang giao dịch (${failures.join("; ")})`);
}

export const resolveAndFetchClosedDailyCandles = (instrument, limit, priority, _minimumCandles, quotePriority) =>
  resolveAndFetchClosedCandles(instrument, "1D", limit, priority, quotePriority);
