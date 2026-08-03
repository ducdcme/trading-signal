export function normalizeSymbol(value) {
  let symbol = value.trim().toUpperCase();
  if (!symbol) return "";
  let exchange = "";
  if (symbol.includes(":")) {
    [exchange, symbol] = symbol.split(":", 2);
    exchange = exchange.replace(/[^A-Z0-9]/g, "");
  }
  symbol = symbol.replace(/[^A-Z0-9]/g, "").replace(/(?:USDT|USDC)$/, "");
  return exchange ? `${exchange}:${symbol}` : symbol;
}

export function parseSymbols(value) {
  const withoutSections = value
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith("###"))
    .join(",");
  return [...new Set(withoutSections.split(/[\s,;]+/).map(normalizeSymbol).filter(Boolean))];
}
