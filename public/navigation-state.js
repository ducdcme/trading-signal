export const appTabs = ["cex", "new-coins", "focus", "dex", "stocks", "automation"];

export function normalizeAppTab(value, fallback = "cex") {
  const tab = String(value || "").trim().toLowerCase();
  return appTabs.includes(tab) ? tab : fallback;
}

export function initialAppTab(hash, savedTab) {
  const hashTab = String(hash || "").replace(/^#/, "");
  if (appTabs.includes(hashTab)) return hashTab;
  return normalizeAppTab(savedTab);
}

export function shouldRestoreScanCache(navigationType) {
  return navigationType !== "reload";
}

export function chartReturnUrl(tab) {
  return `/#${normalizeAppTab(tab)}`;
}
