import test from "node:test";
import assert from "node:assert/strict";
import { mergeDexChartItems, readManualDexItems } from "../public/dex-workspace.js";

const normalize = item => item?.network && item?.tokenAddress ? { ...item, network: item.network.toLowerCase(), tokenAddress: item.tokenAddress } : null;

test("latest DEX scan replaces old scanned tokens while manual chart tokens remain", () => {
  const saved = { manualItems: [{ network: "base", tokenAddress: "manual", poolAddress: "m" }] };
  const manualItems = readManualDexItems(saved, normalize);
  const items = mergeDexChartItems({
    current: { network: "base", tokenAddress: "new-1", poolAddress: "p1" },
    scannedItems: [
      { network: "base", tokenAddress: "new-1", poolAddress: "p1" },
      { network: "base", tokenAddress: "new-2", poolAddress: "p2" },
      { network: "base", tokenAddress: "new-3", poolAddress: "p3" }
    ],
    manualItems,
    normalize
  });
  assert.deepEqual(items.map(item => item.tokenAddress), ["new-1", "new-2", "new-3", "manual"]);
  assert.ok(!items.some(item => item.tokenAddress === "old-scan"));
});

test("legacy accumulated workspace is not treated as manually added tokens", () => {
  assert.deepEqual(readManualDexItems({ items: [{ network: "base", tokenAddress: "old-scan" }] }, normalize), []);
});
