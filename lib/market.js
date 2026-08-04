import { fetchBinanceClosedCandles } from "./binance.js";
import { fetchBybitClosedCandles } from "./bybit.js";
import { fetchOkxClosedCandles } from "./okx.js";
import { fetchBitgetClosedCandles } from "./bitget.js";
import { fetchKucoinClosedCandles } from "./kucoin.js";
import { fetchGateClosedCandles } from "./gate.js";
import { fetchMexcClosedCandles } from "./mexc.js";
import { parseInstrument } from "./instruments.js";
import { MarketNotFoundError } from "./exchange-errors.js";

export async function fetchFromExchange(instrument, timeframe, limit) {
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

export async function resolveAndFetchClosedCandles(instrument, timeframe, limit, priority = ["BINANCE", "OKX", "BYBIT", "BITGET", "KUCOIN", "GATE", "MEXC"], quotePriority = ["USDT", "USDC"]) {
  if (instrument.exchange !== "AUTO") {
    return { instrument, candles: await fetchFromExchange(instrument, timeframe, limit) };
  }
  const failures = [];
  for (const exchange of priority) {
    for (const quote of quotePriority) {
      const candidate = parseInstrument(`${exchange}:${instrument.instrumentId}${quote}`);
      try {
        const candles = await fetchFromExchange(candidate, timeframe, limit);
        return { instrument: candidate, candles };
      } catch (error) {
        if (!(error instanceof MarketNotFoundError)) {
          throw new Error(`${exchange} API lỗi; giữ nguyên thứ tự ưu tiên và không tự chuyển sàn: ${error.message}`);
        }
        failures.push(`${exchange}/${quote}: ${error.message}`);
      }
    }
  }
  throw new Error(`Không tìm thấy cặp Spot USDT đủ dữ liệu (${failures.join("; ")})`);
}

export const resolveAndFetchClosedDailyCandles = (instrument, limit, priority, _minimumCandles, quotePriority) =>
  resolveAndFetchClosedCandles(instrument, "1D", limit, priority, quotePriority);
