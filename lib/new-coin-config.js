const DEFAULTS = Object.freeze({
  timeframe: "8H",
  exchangePriority: ["BINANCE", "OKX", "BYBIT"],
  scanHours: [7, 15, 23],
  scanMinute: 5,
  minimumCandles: 61
});

export function normalizeNewCoinConfig(input = {}) {
  const timeframe = String(input.timeframe || DEFAULTS.timeframe).toUpperCase();
  const exchangePriority = [...new Set(
    (Array.isArray(input.exchangePriority) ? input.exchangePriority : DEFAULTS.exchangePriority)
      .map(exchange => String(exchange).trim().toUpperCase())
      .filter(exchange => DEFAULTS.exchangePriority.includes(exchange))
  )];
  const scanHours = [...new Set(
    (Array.isArray(input.scanHours) ? input.scanHours : DEFAULTS.scanHours)
      .map(Number)
      .filter(hour => Number.isInteger(hour) && hour >= 0 && hour <= 23)
  )].sort((a, b) => a - b);
  const scanMinute = Number(input.scanMinute);
  const minimumCandles = Number(input.minimumCandles);
  return {
    timeframe: timeframe === "8H" ? timeframe : DEFAULTS.timeframe,
    exchangePriority: exchangePriority.length ? exchangePriority : [...DEFAULTS.exchangePriority],
    scanHours: scanHours.length ? scanHours : [...DEFAULTS.scanHours],
    scanMinute: Number.isInteger(scanMinute) && scanMinute >= 0 && scanMinute <= 59 ? scanMinute : DEFAULTS.scanMinute,
    minimumCandles: Number.isInteger(minimumCandles) && minimumCandles >= 61 && minimumCandles <= 500 ? minimumCandles : DEFAULTS.minimumCandles
  };
}

export function isNewCoinScheduleDue(clock, schedule, settings) {
  const config = normalizeNewCoinConfig(settings);
  const [hour, minute] = String(clock?.time || "").split(":").map(Number);
  return schedule?.enabled !== false && config.scanHours.includes(hour) && minute === config.scanMinute;
}
