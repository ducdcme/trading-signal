import { fetchBinanceClosedCandles } from "./binance.js";
import { fetchBybitClosedCandles } from "./bybit.js";
import { fetchOkxClosedCandles } from "./okx.js";
import { fetchBitgetClosedCandles } from "./bitget.js";
import { fetchKucoinClosedCandles } from "./kucoin.js";
import { fetchGateClosedCandles } from "./gate.js";
import { fetchMexcClosedCandles } from "./mexc.js";
import { parseInstrument } from "./instruments.js";
import { isRetryableExchangeError, MarketNotFoundError } from "./exchange-errors.js";
import { fetchActiveSpotCatalog, requireActiveSpotMarket } from "./market-catalog.js";

const TIMEFRAME_MS = { "1H": 3_600_000, "4H": 14_400_000, "1D": 86_400_000 };
const FOCUS_RETRY_DELAYS_MS = [300, 900];
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export function ensureFreshCandles(candles, timeframe, exchange, symbol, now = Date.now()) {
  const duration = TIMEFRAME_MS[timeframe] || TIMEFRAME_MS["1D"];
  const lastClose = candles.at(-1)?.closeTime;
  if (!Number.isFinite(lastClose) || now - lastClose > duration * 2) {
    const date = Number.isFinite(lastClose) ? new Date(lastClose).toISOString().slice(0, 10) : "không xác định";
    throw new MarketNotFoundError(`${exchange} ${symbol} không có nến ${timeframe} mới; nến cuối ${date}`);
  }
  return candles;
}

async function fetchCandlesFromExchange(instrument, timeframe, limit, includeOpen = false) {
  switch (instrument.exchange) {
    case "BINANCE": return fetchBinanceClosedCandles(instrument.instrumentId, timeframe, limit, includeOpen);
    case "OKX": return fetchOkxClosedCandles(instrument.instrumentId, timeframe, limit, includeOpen);
    case "BYBIT": return fetchBybitClosedCandles(instrument.instrumentId, timeframe, limit, includeOpen);
    case "BITGET": return fetchBitgetClosedCandles(instrument.instrumentId, timeframe, limit, includeOpen);
    case "KUCOIN": return fetchKucoinClosedCandles(instrument.instrumentId, timeframe, limit, includeOpen);
    case "GATE": return fetchGateClosedCandles(instrument.instrumentId, timeframe, limit, includeOpen);
    case "MEXC": return fetchMexcClosedCandles(instrument.instrumentId, timeframe, limit, includeOpen);
    default: throw new Error(`Sàn chưa được hỗ trợ: ${instrument.exchange}`);
  }
}

export async function fetchFromExchange(instrument, timeframe, limit, includeOpen = false) {
  const active = await requireActiveSpotMarket(instrument);
  const candles = await fetchCandlesFromExchange(active, timeframe, limit, includeOpen);
  ensureFreshCandles(candles.filter(candle => candle.closeTime < Date.now()), timeframe, active.exchange, active.instrumentId);
  return candles;
}

export async function retryExchangeRequest(fn, delays = FOCUS_RETRY_DELAYS_MS, wait = sleep) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryableExchangeError(error) || attempt >= delays.length) throw error;
      if (delays[attempt] > 0) await wait(delays[attempt]);
    }
  }
}

export async function resolveFocusCandles(item, timeframe, limit, priority, quotePriority, options = {}) {
  const fixed = parseInstrument(`${item.exchange}:${item.instrumentId}`);
  const retryDelays = options.retryDelays ?? FOCUS_RETRY_DELAYS_MS;
  let sourceError;
  try {
    const candles = await retryExchangeRequest(
      () => fetchFromExchange(fixed, timeframe, limit),
      retryDelays,
      options.wait || sleep
    );
    return { instrument: fixed, candles, fallbackUsed: false, sourceWarnings: [] };
  } catch (error) {
    sourceError = error;
  }

  const fallbackPriority = priority.filter(exchange => exchange !== fixed.exchange);
  if (!fallbackPriority.length) throw sourceError;
  try {
    const resolved = await resolveAndFetchClosedCandles(
      parseInstrument(item.asset), timeframe, limit, fallbackPriority, quotePriority
    );
    return {
      ...resolved,
      fallbackUsed: true,
      sourceWarnings: [`${fixed.exchange} ${fixed.instrumentId}: ${sourceError.message}`, ...(resolved.sourceWarnings || [])]
    };
  } catch (fallbackError) {
    throw new Error(`${fixed.exchange} ${fixed.instrumentId} lỗi sau khi thử lại: ${sourceError.message}; fallback thất bại: ${fallbackError.message}`);
  }
}

export async function resolveAndFetchClosedCandles(instrument, timeframe, limit, priority = ["BINANCE", "OKX", "BYBIT", "BITGET", "KUCOIN", "GATE", "MEXC"], quotePriority = ["USDT", "USDC", "FDUSD"], includeOpen = false) {
  if (instrument.exchange !== "AUTO") {
    return { instrument, candles: await fetchFromExchange(instrument, timeframe, limit, includeOpen) };
  }
  const failures = [];
  const apiErrors = [];
  for (const exchange of priority) {
    let catalog;
    try {
      catalog = await fetchActiveSpotCatalog(exchange);
    } catch (error) {
      apiErrors.push(`${exchange} catalog: ${error.message}`);
      continue;
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
        const candles = await fetchCandlesFromExchange(active, timeframe, limit, includeOpen);
        ensureFreshCandles(candles.filter(candle => candle.closeTime < Date.now()), timeframe, active.exchange, active.instrumentId);
        return { instrument: active, candles, sourceWarnings: apiErrors };
      } catch (error) {
        if (!(error instanceof MarketNotFoundError)) {
          apiErrors.push(`${exchange} ${active.instrumentId}: ${error.message}`);
          break;
        }
        failures.push(`${exchange}/${quote}: ${error.message}`);
      }
    }
  }
  if (apiErrors.length) {
    const missing = failures.length ? `; không có cặp: ${failures.join("; ")}` : "";
    throw new Error(`Không lấy được dữ liệu từ các sàn khả dụng; API lỗi: ${apiErrors.join("; ")}${missing}`);
  }
  throw new MarketNotFoundError(`Không tìm thấy cặp Spot đang giao dịch (${failures.join("; ")})`);
}

export const resolveAndFetchClosedDailyCandles = (instrument, limit, priority, _minimumCandles, quotePriority) =>
  resolveAndFetchClosedCandles(instrument, "1D", limit, priority, quotePriority);
