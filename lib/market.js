import { fetchClosedDailyCandles as fetchBinance } from "./binance.js";
import { fetchBybitClosedDailyCandles } from "./bybit.js";
import { fetchOkxClosedDailyCandles } from "./okx.js";
import { parseInstrument } from "./instruments.js";

async function fetchFromExchange(instrument, limit) {
  switch (instrument.exchange) {
    case "BINANCE": return fetchBinance(instrument.instrumentId, limit);
    case "BYBIT": return fetchBybitClosedDailyCandles(instrument.instrumentId, limit);
    case "OKX": return fetchOkxClosedDailyCandles(instrument.instrumentId, limit);
    default: throw new Error(`Sàn chưa được hỗ trợ: ${instrument.exchange}`);
  }
}

export async function resolveAndFetchClosedDailyCandles(instrument, limit, priority = ["BINANCE", "BYBIT", "OKX"], minimumCandles = 100, quotePriority = ["USDT", "USDC"]) {
  if (instrument.exchange !== "AUTO") {
    return { instrument, candles: await fetchFromExchange(instrument, limit) };
  }
  const failures = [];
  for (const exchange of priority) {
    for (const quote of quotePriority) {
      const candidate = parseInstrument(`${exchange}:${instrument.instrumentId}${quote}`);
      try {
        const candles = await fetchFromExchange(candidate, limit);
        if (candles.length < minimumCandles) throw new Error(`chỉ có ${candles.length} nến đã đóng`);
        return { instrument: candidate, candles };
      } catch (error) {
        failures.push(`${exchange}/${quote}: ${error.message}`);
      }
    }
  }
  throw new Error(`Không tìm thấy cặp Spot USDT đủ dữ liệu (${failures.join("; ")})`);
}
