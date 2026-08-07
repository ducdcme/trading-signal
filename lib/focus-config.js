const SUPPORTED_TIMEFRAMES = ["1H", "4H", "8H"];
const DEFAULTS = Object.freeze({
  timeframes: ["4H", "8H"],
  defaultTimeframe: "4H",
  retentionDays: 7,
  scanHours: [3, 7, 11, 15, 19, 23]
});

export function normalizeFocusConfig(input = {}) {
  const timeframes = [...new Set(Array.isArray(input.timeframes) ? input.timeframes.map(value => String(value).toUpperCase()).filter(value => SUPPORTED_TIMEFRAMES.includes(value)) : [])];
  const selectedTimeframes = timeframes.length ? timeframes : [...DEFAULTS.timeframes];
  const requestedDefault = String(input.defaultTimeframe || "").toUpperCase();
  const retentionDays = Number.isInteger(Number(input.retentionDays)) ? Math.min(90, Math.max(1, Number(input.retentionDays))) : DEFAULTS.retentionDays;
  const scanHours = [...new Set(Array.isArray(input.scanHours) ? input.scanHours.map(Number).filter(hour => Number.isInteger(hour) && hour >= 0 && hour <= 23) : [])].sort((a, b) => a - b);
  return {
    timeframes: selectedTimeframes,
    defaultTimeframe: selectedTimeframes.includes(requestedDefault) ? requestedDefault : selectedTimeframes[0],
    retentionDays,
    scanHours: scanHours.length ? scanHours : [...DEFAULTS.scanHours]
  };
}
