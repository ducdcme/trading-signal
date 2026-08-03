function finite(value) {
  return Number.isFinite(value);
}

export function ema(values, length) {
  const out = Array(values.length).fill(null);
  const alpha = 2 / (length + 1);
  let previous = null;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (!finite(value)) continue;
    previous = previous === null ? value : alpha * value + (1 - alpha) * previous;
    out[i] = previous;
  }
  return out;
}

export function sma(values, length) {
  const out = Array(values.length).fill(null);
  const queue = [];
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    queue.push(value);
    if (finite(value)) sum += value;
    if (queue.length > length) {
      const removed = queue.shift();
      if (finite(removed)) sum -= removed;
    }
    if (queue.length === length && queue.every(finite)) out[i] = sum / length;
  }
  return out;
}

export function rma(values, length) {
  const out = Array(values.length).fill(null);
  let seed = [];
  let previous = null;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (!finite(value)) continue;
    if (previous === null) {
      seed.push(value);
      if (seed.length === length) {
        previous = seed.reduce((a, b) => a + b, 0) / length;
        out[i] = previous;
      }
    } else {
      previous = (previous * (length - 1) + value) / length;
      out[i] = previous;
    }
  }
  return out;
}

export function rsi(values, length) {
  const changes = values.map((value, i) => (i === 0 ? null : value - values[i - 1]));
  const gains = changes.map(value => (finite(value) ? Math.max(value, 0) : null));
  const losses = changes.map(value => (finite(value) ? Math.max(-value, 0) : null));
  const avgGain = rma(gains, length);
  const avgLoss = rma(losses, length);
  return values.map((_, i) => {
    if (!finite(avgGain[i]) || !finite(avgLoss[i])) return null;
    if (avgLoss[i] === 0) return avgGain[i] === 0 ? 50 : 100;
    return 100 - 100 / (1 + avgGain[i] / avgLoss[i]);
  });
}

export function extremeAt(values, length, index, mode = "max") {
  if (index < 0) return null;
  const start = Math.max(0, index - length + 1);
  const window = values.slice(start, index + 1).filter(finite);
  if (!window.length) return null;
  return mode === "min" ? Math.min(...window) : Math.max(...window);
}

export const highestAt = (values, length, index) => extremeAt(values, length, index, "max");
export const lowestAt = (values, length, index) => extremeAt(values, length, index, "min");

