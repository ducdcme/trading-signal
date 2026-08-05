const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function measurementPointFromCanvas(x, y, layout) {
  const pointerX = clamp(x, layout.margin.left, layout.width - layout.margin.right);
  const pointerY = clamp(y, layout.margin.top, layout.height - layout.margin.bottom);
  return {
    virtualIndex: layout.startIndex + (pointerX - layout.margin.left) / layout.step,
    price: layout.max - (pointerY - layout.margin.top) / layout.plotHeight * (layout.max - layout.min)
  };
}

export function measurementPointToCanvas(point, layout) {
  return {
    x: layout.margin.left + (point.virtualIndex - layout.startIndex) * layout.step,
    y: layout.margin.top + (layout.max - point.price) / (layout.max - layout.min) * layout.plotHeight
  };
}

export function measurementStats(start, end) {
  const delta = end.price - start.price;
  const percent = start.price === 0 ? null : delta / start.price * 100;
  return {
    delta,
    percent,
    bars: Math.round(Math.abs(end.virtualIndex - start.virtualIndex)),
    rising: delta >= 0
  };
}
