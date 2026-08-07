const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

export function aggregateEightHour(fourHourCandles, now = Date.now(), includeOpen = false) {
  const buckets = new Map();

  for (const candle of fourHourCandles) {
    if (!Number.isFinite(candle.openTime) || !Number.isFinite(candle.closeTime) || candle.openTime > now) continue;
    if (!includeOpen && candle.closeTime >= now) continue;
    const bucketStart = Math.floor(candle.openTime / EIGHT_HOURS_MS) * EIGHT_HOURS_MS;
    const expectedOffset = candle.openTime - bucketStart;
    if (expectedOffset !== 0 && expectedOffset !== FOUR_HOURS_MS) continue;

    const bucket = buckets.get(bucketStart) || { candles: new Map(), duplicated: false };
    if (bucket.candles.has(candle.openTime)) bucket.duplicated = true;
    else bucket.candles.set(candle.openTime, candle);
    buckets.set(bucketStart, bucket);
  }

  const output = [];
  for (const [bucketStart, bucket] of buckets) {
    const first = bucket.candles.get(bucketStart);
    const second = bucket.candles.get(bucketStart + FOUR_HOURS_MS);
    const bucketCloseTime = bucketStart + EIGHT_HOURS_MS - 1;
    const isOpenBucket = bucketStart <= now && bucketCloseTime >= now;
    if (bucket.duplicated || !first || (!second && !(includeOpen && isOpenBucket))) continue;
    const last = second || first;
    output.push({
      openTime: bucketStart,
      open: first.open,
      high: Math.max(first.high, last.high),
      low: Math.min(first.low, last.low),
      close: last.close,
      volume: first.volume + (second?.volume || 0),
      closeTime: bucketCloseTime
    });
  }

  return output.sort((a, b) => a.openTime - b.openTime);
}

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

export function candlesForTimeframe(sourceCandles, timeframe, options = {}) {
  if (timeframe === "8H") return aggregateEightHour(sourceCandles, options.now ?? Date.now(), options.includeOpen === true);
  if (timeframe === "1W") return aggregateWeekly(sourceCandles);
  return sourceCandles;
}
