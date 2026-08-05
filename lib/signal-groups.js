export const EXIT_SHORT = "EXT_SHORT";
export const EXIT_LONG = "EXT_LONG";

export function groupDirectionalSignals(signal = {}) {
  const exitTypes = Array.isArray(signal.exitTypes) ? signal.exitTypes : [];
  const buySignalTypes = [...(signal.buyTypes || [])];
  const sellSignalTypes = [...(signal.sellTypes || [])];
  if (exitTypes.includes(EXIT_SHORT)) buySignalTypes.push(EXIT_SHORT);
  if (exitTypes.includes(EXIT_LONG)) sellSignalTypes.push(EXIT_LONG);
  const status = buySignalTypes.length && sellSignalTypes.length
    ? "BOTH"
    : buySignalTypes.length ? "BUY" : sellSignalTypes.length ? "SELL" : "NONE";
  return { ...signal, buySignalTypes, sellSignalTypes, status };
}

export function signalDisplayName(type) {
  if (type === EXIT_SHORT) return "Exit Short";
  if (type === EXIT_LONG) return "Exit Long";
  return type;
}
