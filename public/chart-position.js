const finite = value => Number.isFinite(Number(value));

export function createPosition({ id, side, entryPoint, targetPoint, stopPoint, createdAtIndex }) {
  if (!entryPoint || !targetPoint || !stopPoint) return null;
  if (![entryPoint.price, targetPoint.price, stopPoint.price].every(finite)) return null;
  const direction = side === "SHORT" ? "SHORT" : "LONG";
  const entry = Number(entryPoint.price);
  const targetRaw = Number(targetPoint.price);
  const stopRaw = Number(stopPoint.price);
  const target = direction === "LONG" ? Math.max(targetRaw, entry) : Math.min(targetRaw, entry);
  const stop = direction === "LONG" ? Math.min(stopRaw, entry) : Math.max(stopRaw, entry);
  const endIndex = Math.max(entryPoint.virtualIndex, targetPoint.virtualIndex, stopPoint.virtualIndex);
  return {
    id,
    side: direction,
    entry,
    target,
    stop,
    startIndex: entryPoint.virtualIndex,
    endIndex,
    createdAtIndex: Math.max(0, Math.trunc(createdAtIndex ?? entryPoint.virtualIndex ?? 0))
  };
}

export function positionOutcome(position, candles, throughIndex) {
  if (!position || !Array.isArray(candles) || !candles.length) return { status: "LIVE", hitIndex: null, exitPrice: null };
  const createdAt = Math.max(0, Math.trunc(Number(position.createdAtIndex) || 0));
  const startIndex = Number.isFinite(Number(position.startIndex)) ? Number(position.startIndex) : createdAt;
  const firstBarAfterEntry = Math.floor(startIndex) + 1;
  const end = Math.min(candles.length - 1, Math.max(createdAt, Math.trunc(throughIndex ?? candles.length - 1)));
  // Never allow an exit before the visual Entry point. This matters when a
  // Long/Short object is placed or moved to the right of the current replay
  // cursor: TP/SL evaluation must begin only on bars after that Entry bar.
  const scanStart = Math.max(createdAt + 1, firstBarAfterEntry);
  for (let index = Math.min(candles.length - 1, scanStart); index <= end; index += 1) {
    const candle = candles[index];
    const high = Number(candle?.high), low = Number(candle?.low);
    if (!finite(high) || !finite(low)) continue;
    const targetHit = position.side === "LONG" ? high >= position.target : low <= position.target;
    const stopHit = position.side === "LONG" ? low <= position.stop : high >= position.stop;
    if (targetHit && stopHit) return { status: "AMBIGUOUS", hitIndex: index, exitPrice: null };
    if (targetHit) return { status: "WIN", hitIndex: index, exitPrice: Number(position.target) };
    if (stopHit) return { status: "LOSE", hitIndex: index, exitPrice: Number(position.stop) };
  }
  return { status: "LIVE", hitIndex: null, exitPrice: null };
}

export function positionRiskReward(position) {
  const risk = Math.abs(Number(position?.entry) - Number(position?.stop));
  const reward = Math.abs(Number(position?.target) - Number(position?.entry));
  return risk > 0 && Number.isFinite(reward) ? reward / risk : null;
}

export function pointInPosition(position, point) {
  if (!position || !point) return false;
  const minIndex = Math.min(position.startIndex, position.endIndex);
  const maxIndex = Math.max(position.startIndex, position.endIndex);
  const minPrice = Math.min(position.stop, position.target);
  const maxPrice = Math.max(position.stop, position.target);
  return point.virtualIndex >= minIndex && point.virtualIndex <= maxIndex && point.price >= minPrice && point.price <= maxPrice;
}


export function createDefaultPosition({ id, side, point, createdAtIndex, riskSize, rewardRisk = 2, widthBars = 12 }) {
  if (!point || !finite(point.price) || !finite(point.virtualIndex)) return null;
  const direction = side === "SHORT" ? "SHORT" : "LONG";
  const entry = Number(point.price);
  const risk = Math.max(Number.EPSILON, Math.abs(Number(riskSize) || Math.abs(entry) * 0.01 || 1));
  const reward = risk * Math.max(0.1, Number(rewardRisk) || 2);
  const target = direction === "LONG" ? entry + reward : entry - reward;
  const stop = direction === "LONG" ? entry - risk : entry + risk;
  return {
    id,
    side: direction,
    entry,
    target,
    stop,
    startIndex: Number(point.virtualIndex),
    endIndex: Number(point.virtualIndex) + Math.max(2, Number(widthBars) || 12),
    createdAtIndex: Math.max(0, Math.trunc(createdAtIndex ?? point.virtualIndex ?? 0))
  };
}

export function translatePosition(position, deltaIndex, deltaPrice, candleCount = Infinity) {
  if (!position || !finite(deltaIndex) || !finite(deltaPrice)) return position;
  const maxCreated = Number.isFinite(candleCount) ? Math.max(0, Math.trunc(candleCount) - 1) : Infinity;
  return {
    ...position,
    startIndex: Number(position.startIndex) + Number(deltaIndex),
    endIndex: Number(position.endIndex) + Number(deltaIndex),
    createdAtIndex: Math.min(maxCreated, Math.max(0, Math.round(Number(position.createdAtIndex) + Number(deltaIndex)))),
    entry: Number(position.entry) + Number(deltaPrice),
    target: Number(position.target) + Number(deltaPrice),
    stop: Number(position.stop) + Number(deltaPrice)
  };
}

export function setPositionLevel(position, level, price) {
  if (!position || !finite(price)) return position;
  const value = Number(price);
  if (level === "target") {
    return { ...position, target: position.side === "SHORT" ? Math.min(value, position.entry) : Math.max(value, position.entry) };
  }
  if (level === "stop") {
    return { ...position, stop: position.side === "SHORT" ? Math.max(value, position.entry) : Math.min(value, position.entry) };
  }
  return position;
}

export function setPositionEnd(position, endIndex, minWidth = 2) {
  if (!position || !finite(endIndex)) return position;
  const start = Number(position.startIndex);
  const width = Math.max(Number(minWidth) || 2, Number(endIndex) - start);
  return { ...position, endIndex: start + width };
}
