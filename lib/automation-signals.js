export function signalKey(row, timeframe) {
  const exchange = row.deliveryExchange || row.exchange;
  const instrumentId = row.deliveryInstrumentId || row.instrumentId || row.symbol;
  return [row.assetType || "CEX", exchange, instrumentId, row.network || "", row.tokenAddress || "", timeframe, row.candleOpenTime, row.status, ...(row.buySignalTypes || row.buyTypes || []), ...(row.sellSignalTypes || row.sellTypes || [])].join("|");
}

export function selectDeliverySignals(rows, sentKeys, timeframe, trigger) {
  const detected = rows.filter(row => ["BUY", "SELL", "BOTH"].includes(row.status));
  const nextSentKeys = new Set(sentKeys || []);

  // Manual runs are explicit checks: always return the complete current list
  // and do not alter the scheduler's deduplication history.
  if (trigger !== "schedule") {
    return { detected, delivered: detected, suppressed: 0, sentKeys: [...nextSentKeys] };
  }

  const delivered = detected.filter(row => !nextSentKeys.has(signalKey(row, timeframe)));
  for (const row of delivered) nextSentKeys.add(signalKey(row, timeframe));
  return { detected, delivered, suppressed: detected.length - delivered.length, sentKeys: [...nextSentKeys] };
}
