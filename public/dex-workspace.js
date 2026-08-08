const tokenKey = item => `${String(item.network).toLowerCase()}:${String(item.tokenAddress).toLowerCase()}`;

export function mergeDexChartItems({ current = null, scannedItems = [], manualItems = [], normalize, maximum = 100 }) {
  const sources = [
    ...(current ? [{ ...current, workspaceSource: "current" }] : []),
    ...scannedItems.map(item => ({ ...item, workspaceSource: "scan" })),
    ...manualItems.map(item => ({ ...item, workspaceSource: "manual" }))
  ];
  const merged = new Map();
  for (const source of sources) {
    const item = normalize(source);
    if (!item) continue;
    const key = tokenKey(item);
    const existing = merged.get(key);
    if (!existing || item.workspaceSource === "manual") merged.set(key, item);
  }
  return [...merged.values()].slice(0, maximum);
}

export function readManualDexItems(saved, normalize) {
  if (!Array.isArray(saved?.manualItems)) return [];
  return saved.manualItems.map(item => normalize({ ...item, workspaceSource: "manual" })).filter(Boolean);
}
