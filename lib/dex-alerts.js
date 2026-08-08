export function assertPinnedDexAlertTokens(tokens) {
  if (!Array.isArray(tokens) || !tokens.length) throw new Error("Watchlist DEX tự động đang trống");
  if (tokens.some(token => !String(token.poolAddress || "").trim())) {
    throw new Error("Cảnh báo DEX 4H/8H yêu cầu ghim pool cho mọi token");
  }
  return tokens;
}
