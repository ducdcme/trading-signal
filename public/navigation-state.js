export const appTabs = [
  "cex", "new-coins", "focus", "dex",
  "metals-overview", "metals-vietnam", "metals-world", "metals-compare",
  "stocks", "automation"
];

export const appMarkets = ["crypto", "metals", "stocks", "automation"];

const marketTabs = {
  crypto: ["cex", "new-coins", "focus", "dex"],
  metals: ["metals-overview", "metals-vietnam", "metals-world", "metals-compare"],
  stocks: ["stocks"],
  automation: ["automation"]
};

const legacyTabs = { metals: "metals-overview" };

export function normalizeAppTab(value, fallback = "cex") {
  const tab = String(value || "").trim().toLowerCase();
  return appTabs.includes(tab) ? tab : (legacyTabs[tab] || fallback);
}

export function marketForTab(value) {
  const tab = normalizeAppTab(value);
  return appMarkets.find(market => marketTabs[market].includes(tab)) || "crypto";
}

export function defaultTabForMarket(value) {
  const market = appMarkets.includes(value) ? value : "crypto";
  return marketTabs[market][0];
}

export function initialAppTab(hash, savedTab) {
  const hashTab = String(hash || "").replace(/^#/, "");
  if (appTabs.includes(hashTab) || legacyTabs[hashTab]) return normalizeAppTab(hashTab);
  return normalizeAppTab(savedTab);
}

export function shouldRestoreScanCache(navigationType) {
  return navigationType !== "reload";
}

export function chartReturnUrl(tab) {
  return `/#${normalizeAppTab(tab)}`;
}
