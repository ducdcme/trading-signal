export async function scanDexTokensSequentially(tokens, timeframe, requestToken, onProgress = () => {}) {
  const results = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    onProgress({ completed: index, total: tokens.length, token });
    try {
      const data = await requestToken(token, timeframe);
      results.push(...(Array.isArray(data?.results) ? data.results : []));
    } catch (error) {
      results.push({
        assetType: "DEX",
        exchange: "GECKOTERMINAL",
        instrumentId: token.tokenAddress.slice(0, 10),
        network: token.network,
        tokenAddress: token.tokenAddress,
        poolAddress: token.poolAddress || "",
        timeframe,
        status: "ERROR",
        error: error.message
      });
    }
    onProgress({ completed: index + 1, total: tokens.length, token });
  }
  return { generatedAt: Date.now(), timeframe, closedBarsOnly: true, results };
}
