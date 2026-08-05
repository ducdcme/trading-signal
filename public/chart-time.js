export const CHART_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function formatChartDate(value, timeframe, timeZone = CHART_TIME_ZONE) {
  const intraday = timeframe === "1H" || timeframe === "4H";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: intraday ? "2-digit" : undefined,
    minute: intraday ? "2-digit" : undefined,
    hourCycle: intraday ? "h23" : undefined
  }).format(value);
}
