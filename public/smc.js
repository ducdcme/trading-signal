const finite = value => Number.isFinite(Number(value));

function closedCandles(candles) {
  const lastClosedIndex = candles.reduce((last, candle, index) => candle?.isClosed === false ? last : index, -1);
  return candles.slice(0, lastClosedIndex + 1);
}

function isPivot(candles, index, length, field, direction) {
  const value = Number(candles[index]?.[field]);
  if (!finite(value)) return false;
  for (let offset = 1; offset <= length; offset += 1) {
    const left = Number(candles[index - offset]?.[field]);
    const right = Number(candles[index + offset]?.[field]);
    if (!finite(left) || !finite(right)) return false;
    if (direction === "HIGH" && (value <= left || value <= right)) return false;
    if (direction === "LOW" && (value >= left || value >= right)) return false;
  }
  return true;
}

function trueRange(candle, previousClose) {
  const high = Number(candle?.high), low = Number(candle?.low);
  if (!finite(high) || !finite(low)) return 0;
  if (!finite(previousClose)) return high - low;
  return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
}

function averageTrueRange(candles, index, length = 14) {
  const start = Math.max(0, index - length + 1);
  const ranges = [];
  for (let cursor = start; cursor <= index; cursor += 1) {
    ranges.push(trueRange(candles[cursor], cursor ? Number(candles[cursor - 1]?.close) : null));
  }
  return ranges.length ? ranges.reduce((sum, value) => sum + value, 0) / ranges.length : 0;
}

export function findStructurePivots(candles, pivotLength = 5) {
  const source = closedCandles(Array.isArray(candles) ? candles : []);
  const length = Math.max(1, Math.floor(Number(pivotLength) || 1));
  const pivots = [];
  for (let index = length; index < source.length - length; index += 1) {
    if (isPivot(source, index, length, "high", "HIGH")) {
      pivots.push({ type: "HIGH", index, confirmedIndex: index + length, price: Number(source[index].high) });
    }
    if (isPivot(source, index, length, "low", "LOW")) {
      pivots.push({ type: "LOW", index, confirmedIndex: index + length, price: Number(source[index].low) });
    }
  }
  return pivots.sort((a, b) => a.confirmedIndex - b.confirmedIndex || a.index - b.index);
}

export function analyzeMarketStructure(candles, { pivotLength = 5 } = {}) {
  const source = closedCandles(Array.isArray(candles) ? candles : []);
  const pivots = findStructurePivots(source, pivotLength);
  const confirmations = new Map();
  for (const pivot of pivots) {
    if (!confirmations.has(pivot.confirmedIndex)) confirmations.set(pivot.confirmedIndex, []);
    confirmations.get(pivot.confirmedIndex).push(pivot);
  }

  let trend = 0;
  let lastHigh = null;
  let lastLow = null;
  const breaks = [];
  for (let index = 0; index < source.length; index += 1) {
    for (const pivot of confirmations.get(index) || []) {
      if (pivot.type === "HIGH") lastHigh = { ...pivot, broken: false };
      else lastLow = { ...pivot, broken: false };
    }
    const close = Number(source[index]?.close);
    if (!finite(close)) continue;
    if (lastHigh && !lastHigh.broken && close > lastHigh.price) {
      const type = trend === -1 ? "CHoCH" : "BOS";
      trend = 1;
      lastHigh.broken = true;
      breaks.push({ type, direction: "BULLISH", index, price: lastHigh.price, pivotIndex: lastHigh.index });
    }
    if (lastLow && !lastLow.broken && close < lastLow.price) {
      const type = trend === 1 ? "CHoCH" : "BOS";
      trend = -1;
      lastLow.broken = true;
      breaks.push({ type, direction: "BEARISH", index, price: lastLow.price, pivotIndex: lastLow.index });
    }
  }
  return { pivotLength: Math.max(1, Math.floor(Number(pivotLength) || 1)), pivots, breaks, trend };
}

export function findOrderBlocks(candles, structure, { maximum = 12 } = {}) {
  const source = closedCandles(Array.isArray(candles) ? candles : []);
  const blocks = [];
  for (const event of structure?.breaks || []) {
    const bullish = event.direction === "BULLISH";
    let candleIndex = -1;
    for (let index = event.index - 1; index >= Math.max(0, event.pivotIndex); index -= 1) {
      const open = Number(source[index]?.open), close = Number(source[index]?.close);
      if ((bullish && close < open) || (!bullish && close > open)) { candleIndex = index; break; }
    }
    if (candleIndex < 0) continue;
    const top = Number(source[candleIndex].high), bottom = Number(source[candleIndex].low);
    let mitigatedIndex = null;
    for (let index = event.index + 1; index < source.length; index += 1) {
      const close = Number(source[index]?.close);
      if ((bullish && close < bottom) || (!bullish && close > top)) { mitigatedIndex = index; break; }
    }
    blocks.push({ direction: event.direction, index: candleIndex, confirmedIndex: event.index, top, bottom, mitigatedIndex, active: mitigatedIndex == null });
  }
  return blocks.slice(-Math.max(1, Number(maximum) || 12));
}

export function findFairValueGaps(candles, { maximum = 20 } = {}) {
  const source = closedCandles(Array.isArray(candles) ? candles : []);
  const gaps = [];
  for (let index = 2; index < source.length; index += 1) {
    const first = source[index - 2], third = source[index];
    let direction = null, top = null, bottom = null;
    if (Number(third.low) > Number(first.high)) {
      direction = "BULLISH"; top = Number(third.low); bottom = Number(first.high);
    } else if (Number(third.high) < Number(first.low)) {
      direction = "BEARISH"; top = Number(first.low); bottom = Number(third.high);
    }
    if (!direction) continue;
    let mitigatedIndex = null;
    for (let cursor = index + 1; cursor < source.length; cursor += 1) {
      if ((direction === "BULLISH" && Number(source[cursor].low) <= bottom) ||
          (direction === "BEARISH" && Number(source[cursor].high) >= top)) {
        mitigatedIndex = cursor; break;
      }
    }
    gaps.push({ direction, index: index - 2, confirmedIndex: index, top, bottom, mitigatedIndex, active: mitigatedIndex == null });
  }
  return gaps.slice(-Math.max(1, Number(maximum) || 20));
}

export function findEqualLevels(candles, pivots, { atrLength = 14, threshold = 0.1, maximum = 20 } = {}) {
  const source = closedCandles(Array.isArray(candles) ? candles : []);
  const levels = [];
  const previous = { HIGH: null, LOW: null };
  for (const pivot of pivots || []) {
    const earlier = previous[pivot.type];
    if (earlier) {
      const atr = averageTrueRange(source, pivot.confirmedIndex, atrLength);
      const tolerance = atr * Math.max(0, Number(threshold) || 0);
      if (Math.abs(pivot.price - earlier.price) <= tolerance) {
        levels.push({
          type: pivot.type === "HIGH" ? "EQH" : "EQL",
          direction: pivot.type === "HIGH" ? "BEARISH" : "BULLISH",
          fromIndex: earlier.index,
          index: pivot.index,
          confirmedIndex: pivot.confirmedIndex,
          price: (earlier.price + pivot.price) / 2,
          tolerance
        });
      }
    }
    previous[pivot.type] = pivot;
  }
  return levels.slice(-Math.max(1, Number(maximum) || 20));
}

export function findPremiumDiscountRange(candles, structure) {
  const source = closedCandles(Array.isArray(candles) ? candles : []);
  const trend = Number(structure?.trend) > 0 ? 1 : Number(structure?.trend) < 0 ? -1 : 0;
  const pivots = Array.isArray(structure?.pivots)
    ? structure.pivots.filter(pivot => pivot?.confirmedIndex < source.length && finite(pivot?.price))
    : [];
  if (!trend || pivots.length < 2) return null;

  const targetType = trend > 0 ? "HIGH" : "LOW";
  const anchorType = trend > 0 ? "LOW" : "HIGH";
  const target = [...pivots].reverse().find(pivot => pivot.type === targetType);
  const anchor = target
    ? [...pivots].reverse().find(pivot => pivot.type === anchorType && pivot.index < target.index)
    : null;
  if (!anchor || !target) return null;

  const lowPivot = trend > 0 ? anchor : target;
  const highPivot = trend > 0 ? target : anchor;
  const low = Number(lowPivot.price), high = Number(highPivot.price);
  if (!(high > low)) return null;

  return {
    direction: trend > 0 ? "BULLISH" : "BEARISH",
    fromIndex: anchor.index,
    toIndex: target.index,
    confirmedIndex: Math.max(anchor.confirmedIndex, target.confirmedIndex),
    low,
    high,
    equilibrium: low + (high - low) * 0.5
  };
}

export function buildSmcLayers(candles, { swingLength = 5, internalLength = 2 } = {}) {
  const swing = analyzeMarketStructure(candles, { pivotLength: swingLength });
  const internal = analyzeMarketStructure(candles, { pivotLength: internalLength });
  return {
    swing,
    internal,
    orderBlocks: findOrderBlocks(candles, swing),
    fairValueGaps: findFairValueGaps(candles),
    equalLevels: findEqualLevels(candles, swing.pivots),
    premiumDiscount: findPremiumDiscountRange(candles, swing)
  };
}
