export function distanceBetweenPointers(first, second) {
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

export function midpointBetweenPointers(first, second) {
  return {
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2
  };
}

export function pinchBarCount(startBarCount, startDistance, currentDistance) {
  if (![startBarCount, startDistance, currentDistance].every(Number.isFinite) || startDistance <= 0 || currentDistance <= 0) return startBarCount;
  return startBarCount * startDistance / currentDistance;
}

export function plotAnchorRatio(clientX, canvasLeft, marginLeft, plotWidth) {
  if (![clientX, canvasLeft, marginLeft, plotWidth].every(Number.isFinite) || plotWidth <= 0) return 0.5;
  return Math.min(1, Math.max(0, (clientX - canvasLeft - marginLeft) / plotWidth));
}
