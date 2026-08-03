const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export function aggregateWeekly(dailyCandles) {
  const weeks = new Map();
  for (const candle of dailyCandles) {
    const date = new Date(candle.openTime);
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    const weekStart = candle.openTime - daysSinceMonday * DAY_MS;
    let week = weeks.get(weekStart);
    if (!week) {
      week = { openTime: weekStart, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume, closeTime: weekStart + WEEK_MS - 1 };
      weeks.set(weekStart, week);
    } else {
      week.high = Math.max(week.high, candle.high);
      week.low = Math.min(week.low, candle.low);
      week.close = candle.close;
      week.volume += candle.volume;
    }
  }
  const now = Date.now();
  return [...weeks.values()].filter(week => week.closeTime < now).sort((a, b) => a.openTime - b.openTime);
}

export function candlesForTimeframe(dailyCandles, timeframe) {
  return timeframe === "1W" ? aggregateWeekly(dailyCandles) : dailyCandles;
}

