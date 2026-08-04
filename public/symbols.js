export function normalizeSymbol(value) {
  let symbol = value.trim().toUpperCase();
  if (!symbol) return "";
  if (symbol.includes(":")) {
    [, symbol] = symbol.split(":", 2);
  }
  return symbol.replace(/[^A-Z0-9]/g, "").replace(/(?:FDUSD|USDT|USDC)$/, "");
}

export function parseSymbols(value) {
  const withoutSections = value
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith("###"))
    .join(",");
  return [...new Set(withoutSections.split(/[\s,;]+/).map(normalizeSymbol).filter(Boolean))];
}
