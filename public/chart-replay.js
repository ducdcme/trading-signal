export function replayCandleCount(total, cursorIndex) {
  const safeTotal = Math.max(0, Number(total) || 0);
  if (!safeTotal) return 0;
  if (!Number.isInteger(cursorIndex)) return safeTotal;
  return Math.min(safeTotal, Math.max(1, cursorIndex + 1));
}

export function replayCandles(candles, cursorIndex) {
  if (!Array.isArray(candles)) return [];
  return candles.slice(0, replayCandleCount(candles.length, cursorIndex));
}

export function replayIndexFromCanvasX(pointerX, layout, totalCandles) {
  if (!layout || !Number.isFinite(pointerX) || !totalCandles) return null;
  const { margin, width, step, startIndex } = layout;
  if (!margin || !Number.isFinite(step) || step <= 0) return null;
  if (pointerX < margin.left || pointerX >= width - margin.right) return null;
  const slotIndex = Math.floor((pointerX - margin.left) / step);
  const index = startIndex + slotIndex;
  return Math.min(totalCandles - 1, Math.max(0, index));
}

export function stepReplayIndex(index, delta, totalCandles) {
  if (!totalCandles) return null;
  const current = Number.isInteger(index) ? index : totalCandles - 1;
  return Math.min(totalCandles - 1, Math.max(0, current + delta));
}
