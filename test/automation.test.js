import test from "node:test";
import assert from "node:assert/strict";
import { localClock, normalizeAutomation } from "../lib/automation-store.js";
import { splitTelegramText } from "../lib/telegram.js";
import { selectDeliverySignals, signalKey } from "../lib/automation-signals.js";
import { groupDirectionalSignals, signalDisplayName } from "../lib/signal-groups.js";
import { formatAutomationReport, formatScheduledBatchReport } from "../lib/automation-report.js";
import { assertPinnedDexAlertTokens } from "../lib/dex-alerts.js";
import { formatNewCoinReport } from "../lib/new-coin-automation.js";

test("migrates version 1 automation settings to the multi-asset schema", () => {
  const settings = normalizeAutomation({
    enabled: true,
    chatId: " -100123 ",
    daily: { enabled: true, time: "07:20" },
    weekly: { enabled: true, day: 1, time: "07:30" },
    cexSymbols: ["BTC", "BTC", "ETH"],
    dexTokens: [{ network: "BASE", tokenAddress: "0xabc" }]
  });
  assert.equal(settings.schemaVersion, 11);
  assert.equal(settings.telegram.chatId, "-100123");
  assert.deepEqual(settings.assets.cex.watchlist, ["BTC", "ETH"]);
  assert.equal(settings.assets.dex.watchlist[0].network, "base");
  assert.equal(settings.schedules.cryptoWeekly.day, 1);
  assert.equal(settings.assets.stocks.enabled, false);
  assert.deepEqual(settings.assets.stocks.watchlist, []);
  assert.deepEqual(settings.assets.stocks.scopes, ["WATCHLIST"]);
  assert.deepEqual(settings.schedules.closedCandle, { minute: 5 });
  assert.deepEqual(settings.schedules.focusScan, { enabled: true });
  assert.deepEqual(settings.schedules.newCoinScan, { enabled: true });
  assert.deepEqual(settings.schedules.dex4h, { enabled: false });
  assert.deepEqual(settings.schedules.dex8h, { enabled: false });
  assert.deepEqual(settings.assets.metals, {
    enabled: true,
    products: ["VN_GOLD_SJC_BAR", "VN_GOLD_RING_9999", "VN_SILVER_999_KG"],
    side: "SELL"
  });
  assert.deepEqual(settings.schedules.metalsDaily, { enabled: false, time: "07:10" });
});

test("metals automation is fixed to three domestic SELL products", () => {
  const settings = normalizeAutomation({
    assets: { metals: { enabled: true, products: ["XAU_USD"], side: "BUY" } },
    schedules: { metalsDaily: { enabled: true, time: "09:05" } }
  });
  assert.deepEqual(settings.assets.metals.products, ["VN_GOLD_SJC_BAR", "VN_GOLD_RING_9999", "VN_SILVER_999_KG"]);
  assert.equal(settings.assets.metals.side, "SELL");
  assert.deepEqual(settings.schedules.metalsDaily, { enabled: true, time: "09:05" });
});

test("keeps stock settings and independent schedules during schema migration", () => {
  const settings = normalizeAutomation({
    schemaVersion: 2,
    assets: { stocks: { enabled: true, watchlist: ["fpt", "HOSE:HPG"], scopes: ["watchlist", "vn30", "vn30"] } },
    schedules: { stockDaily: { enabled: false, time: "15:30" }, stockWeekly: { enabled: false, day: 5, time: "15:35" } }
  });
  assert.deepEqual(settings.assets.stocks.watchlist, ["FPT", "HOSE:HPG"]);
  assert.equal(settings.assets.stocks.enabled, true);
  assert.deepEqual(settings.assets.stocks.scopes, ["WATCHLIST", "VN30"]);
  assert.deepEqual(settings.schedules.stockDaily, { enabled: false, time: "07:00" });
  assert.deepEqual(settings.schedules.stockWeekly, { enabled: false, day: 5, time: "15:35" });
});

test("preserves a custom Stock D1 time while migrating to schema v11", () => {
  const settings = normalizeAutomation({
    schemaVersion: 10,
    schedules: { stockDaily: { enabled: true, time: "10:32" } }
  });
  assert.deepEqual(settings.schedules.stockDaily, { enabled: true, time: "10:32" });
});

test("preserves a pinned DEX pool in automation settings", () => {
  const settings = normalizeAutomation({
    schemaVersion: 4,
    assets: { dex: { enabled: true, watchlist: [{ network: "SOLANA", tokenAddress: "token-address", poolAddress: "pool-address" }] } }
  });
  assert.deepEqual(settings.assets.dex.watchlist, [{ network: "solana", tokenAddress: "token-address", poolAddress: "pool-address" }]);
});

test("preserves independent DEX 4H and 8H alert switches", () => {
  const settings = normalizeAutomation({ schedules: { dex4h: { enabled: true }, dex8h: { enabled: false } } });
  assert.deepEqual(settings.schedules.dex4h, { enabled: true });
  assert.deepEqual(settings.schedules.dex8h, { enabled: false });
});

test("calculates scheduler clock in Viet Nam timezone", () => {
  assert.deepEqual(localClock(new Date("2026-08-03T00:10:00Z")), { date: "2026-08-03", time: "07:10", day: 1 });
});

test("splits long Telegram messages below the safe limit", () => {
  const chunks = splitTelegramText(["a".repeat(20), "b".repeat(20), "c".repeat(20)].join("\n"), 30);
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every(chunk => chunk.length <= 30));
});

test("manual runs always deliver the complete current signal list", () => {
  const atom = { exchange: "BINANCE", instrumentId: "ATOMUSDT", candleOpenTime: 1, status: "BUY", buyTypes: ["B", "BB"] };
  const audi = { exchange: "BINANCE", instrumentId: "AUDIOUSDT", candleOpenTime: 1, status: "BUY", buyTypes: ["B"] };
  const priorKeys = [signalKey(atom, "1D")];
  const result = selectDeliverySignals([atom, audi], priorKeys, "1D", "manual");
  assert.deepEqual(result.delivered, [atom, audi]);
  assert.equal(result.suppressed, 0);
  assert.deepEqual(result.sentKeys, priorKeys);
});

test("scheduled runs still suppress signals already delivered automatically", () => {
  const atom = { exchange: "BINANCE", instrumentId: "ATOMUSDT", candleOpenTime: 1, status: "BUY", buyTypes: ["B", "BB"] };
  const audi = { exchange: "BINANCE", instrumentId: "AUDIOUSDT", candleOpenTime: 1, status: "BUY", buyTypes: ["B"] };
  const result = selectDeliverySignals([atom, audi], [signalKey(atom, "1D")], "1D", "schedule");
  assert.deepEqual(result.delivered, [audi]);
  assert.equal(result.suppressed, 1);
  assert.equal(result.sentKeys.length, 2);
});

test("DEX signal deduplication includes the pinned pool address", () => {
  const base = { assetType: "DEX", exchange: "GECKOTERMINAL", instrumentId: "TOKEN", network: "base", tokenAddress: "0xtoken", candleOpenTime: 1, status: "BUY", buySignalTypes: ["B"] };
  assert.notEqual(signalKey({ ...base, poolAddress: "0xpool1" }, "4H"), signalKey({ ...base, poolAddress: "0xpool2" }, "4H"));
});

test("metals signal deduplication includes SELL without changing legacy CEX keys", () => {
  const cex = { assetType: "CEX", exchange: "BINANCE", instrumentId: "BTCUSDT", candleOpenTime: 1, status: "BUY", buySignalTypes: ["B"] };
  assert.equal(signalKey(cex, "1D"), "CEX|BINANCE|BTCUSDT||||1D|1|BUY|B");
  const metal = { assetType: "METALS", exchange: "METALS_DATA_COLLECTOR", instrumentId: "VN_GOLD_SJC_BAR", side: "SELL", candleOpenTime: 1, status: "BUY", buySignalTypes: ["B"] };
  assert.match(signalKey(metal, "1D"), /VN_GOLD_SJC_BAR\|\|\|\|SELL\|1D/);
});

test("DEX Telegram report identifies timeframe, contract and pinned pool without exposing error details", () => {
  const row = {
    assetType: "DEX", exchange: "GECKOTERMINAL", instrumentId: "TOKEN", network: "base", dex: "aerodrome",
    tokenAddress: "0xtoken", poolAddress: "0xpool", poolName: "TOKEN / WETH", close: 1.25,
    status: "BUY", buySignalTypes: ["B"]
  };
  const error = { assetType: "DEX", status: "ERROR", error: "fetch failed: private upstream detail" };
  const report = formatAutomationReport("4H", [row, error], { delivered: [row], suppressed: 0 }, { timezone: "Asia/Ho_Chi_Minh", telegram: { sendNoSignalSummary: true } }, "schedule", "DEX");
  assert.match(report, /Trading Signal · DEX · 4H/);
  assert.match(report, /Contract: 0xtoken/);
  assert.match(report, /Pool: TOKEN \/ WETH/);
  assert.match(report, /Loại lỗi: Lỗi mạng: 1/);
  assert.doesNotMatch(report, /private upstream detail/);
});

test("metals Telegram report uses domestic name, SELL side and formatted VND close", () => {
  const row = {
    assetType: "METALS", exchange: "METALS_DATA_COLLECTOR", instrumentId: "VN_GOLD_SJC_BAR",
    productName: "Vàng miếng SJC", side: "SELL", close: 147600000,
    status: "BUY", buySignalTypes: ["B"]
  };
  const report = formatAutomationReport("1D", [row], { delivered: [row], suppressed: 0 }, { timezone: "Asia/Ho_Chi_Minh", telegram: { sendNoSignalSummary: true } }, "manual", "VÀNG & BẠC SELL");
  assert.match(report, /VÀNG & BẠC SELL · 1D/);
  assert.match(report, /Vàng miếng SJC · SELL · Việt Nam/);
  assert.match(report, /Giá bán đóng: 147\.600\.000 ₫/);
  assert.doesNotMatch(report, /XAU|XAG|USD\/VND/);
});

test("stock Telegram report labels price in thousand VND", () => {
  const row = { assetType: "STOCK", exchange: "HOSE", instrumentId: "FPT", close: 70.7, status: "BUY", buySignalTypes: ["B"] };
  const report = formatAutomationReport("1D", [row], { delivered: [row], suppressed: 0 }, { timezone: "Asia/Ho_Chi_Minh", telegram: { sendNoSignalSummary: true } }, "manual", "CHỨNG KHOÁN VN · VN30");
  assert.match(report, /CHỨNG KHOÁN VN · VN30 · 1D/);
  assert.match(report, /70,7 nghìn ₫/);
});

test("scheduled summaries omit the no-signal sentence and can be combined into one Telegram report", () => {
  const settings = { timezone: "Asia/Ho_Chi_Minh", telegram: { sendNoSignalSummary: true } };
  const dex = formatAutomationReport("8H", [{ assetType: "DEX", status: "NONE" }], { delivered: [], suppressed: 0 }, settings, "schedule", "DEX");
  const coin = formatAutomationReport("4H", [{ exchange: "BINANCE", status: "NONE" }], { delivered: [], suppressed: 0 }, settings, "schedule", "CEX");
  assert.doesNotMatch(dex, /Không có tín hiệu/);
  const combined = formatScheduledBatchReport([dex, coin], settings, new Date("2026-08-08T00:05:00Z"));
  assert.equal((combined.match(/Báo cáo tự động/g) || []).length, 1);
  assert.match(combined, /DEX · 8H/);
  assert.match(combined, /COIN · 4H/);
  assert.equal((combined.match(/Trading Signal/g) || []).length, 1);
  assert.equal((combined.match(/Thời điểm:/g) || []).length, 1);
  assert.equal((combined.match(/Chế độ:/g) || []).length, 0);
  assert.equal((combined.match(/Đã quét:/g) || []).length, 2);
});

test("scheduled batch uses compact asset headings under one Trading Signal header", () => {
  const settings = { timezone: "Asia/Ho_Chi_Minh", telegram: { sendNoSignalSummary: true } };
  const coin = formatAutomationReport("1D", [{ status: "NONE" }], { delivered: [], suppressed: 0 }, settings, "schedule");
  const metals = formatAutomationReport("1D", [{ assetType: "METALS", status: "NONE" }], { delivered: [], suppressed: 0 }, settings, "schedule", "VÀNG & BẠC SELL");
  const stocks = formatAutomationReport("1D", [{ assetType: "STOCK", status: "NONE" }], { delivered: [], suppressed: 0 }, settings, "schedule", "CHỨNG KHOÁN VN · WATCHLIST");
  const newCoins = formatNewCoinReport([{ status: "NONE" }], { delivered: [], suppressed: 0, paused: 0 }, settings, "schedule", "8H");
  const combined = formatScheduledBatchReport([coin, metals, stocks, newCoins], settings, new Date("2026-08-26T00:00:00Z"));
  assert.equal((combined.match(/Trading Signal/g) || []).length, 1);
  assert.match(combined, /📊 COIN · 1D/);
  assert.match(combined, /🥇 VÀNG & BẠC · SELL · 1D/);
  assert.match(combined, /📈 CHỨNG KHOÁN · WATCHLIST · 1D/);
  assert.match(combined, /🆕 COIN MỚI · 8H/);
});

test("DEX small-timeframe alerts require every token to have a pinned pool", () => {
  const pinned = [{ network: "base", tokenAddress: "0xtoken", poolAddress: "0xpool" }];
  assert.deepEqual(assertPinnedDexAlertTokens(pinned), pinned);
  assert.throws(() => assertPinnedDexAlertTokens([{ network: "base", tokenAddress: "0xtoken" }]), /yêu cầu ghim pool/);
});

test("focus fallback keeps the original market identity for deduplication", () => {
  const original = {
    assetType: "FOCUS", symbol: "CHIP", exchange: "BINANCE", instrumentId: "CHIPUSDT",
    candleOpenTime: 10, status: "BUY", buySignalTypes: ["B"]
  };
  const fallback = {
    ...original, exchange: "BYBIT", instrumentId: "CHIPUSDT",
    deliveryExchange: "BINANCE", deliveryInstrumentId: "CHIPUSDT", fallbackUsed: true
  };
  assert.equal(signalKey(fallback, "FOCUS"), signalKey(original, "FOCUS"));
  const result = selectDeliverySignals([fallback], [signalKey(original, "FOCUS")], "FOCUS", "schedule");
  assert.equal(result.delivered.length, 0);
  assert.equal(result.suppressed, 1);
});

test("Exit Short is actionable BUY and Exit Long is actionable SELL", () => {
  const exitShort = groupDirectionalSignals({ buyTypes: [], sellTypes: [], exitTypes: ["EXT_SHORT"] });
  const exitLong = groupDirectionalSignals({ buyTypes: [], sellTypes: [], exitTypes: ["EXT_LONG"] });
  assert.equal(exitShort.status, "BUY");
  assert.deepEqual(exitShort.buySignalTypes, ["EXT_SHORT"]);
  assert.equal(exitLong.status, "SELL");
  assert.deepEqual(exitLong.sellSignalTypes, ["EXT_LONG"]);
  assert.equal(signalDisplayName("EXT_SHORT"), "Exit Short");
  assert.equal(signalDisplayName("EXT_LONG"), "Exit Long");
});

test("Exit signals combine with Pine buy and sell signals", () => {
  const grouped = groupDirectionalSignals({ buyTypes: ["B"], sellTypes: [], exitTypes: ["EXT_LONG"] });
  assert.equal(grouped.status, "BOTH");
  assert.deepEqual(grouped.buySignalTypes, ["B"]);
  assert.deepEqual(grouped.sellSignalTypes, ["EXT_LONG"]);
});


test("scheduled jobs can share the updated dedup state inside one batch slot", () => {
  const row = { assetType: "STOCK", exchange: "HOSE", instrumentId: "FPT", candleOpenTime: 10, status: "BUY", buySignalTypes: ["B"] };
  const first = selectDeliverySignals([row], [], "1D", "schedule");
  const second = selectDeliverySignals([row], first.sentKeys, "1D", "schedule");
  assert.equal(first.delivered.length, 1);
  assert.equal(second.delivered.length, 0);
  assert.equal(second.suppressed, 1);
});

test("scheduled batch isolates failed groups and reports counts without error details", () => {
  const settings = { timezone: "Asia/Ho_Chi_Minh", telegram: { sendNoSignalSummary: true } };
  const stock = formatAutomationReport("1D", [{ assetType: "STOCK", exchange: "HOSE", instrumentId: "FPT", close: 70, status: "NONE" }], { delivered: [], suppressed: 0 }, settings, "schedule", "CHỨNG KHOÁN VN · VN30");
  const combined = formatScheduledBatchReport([stock], settings, new Date("2026-08-26T08:30:00Z"), [{ key: "metalsDaily", label: "Vàng/Bạc D1", errors: 1 }]);
  assert.match(combined, /CHỨNG KHOÁN · VN30/);
  assert.match(combined, /Vàng\/Bạc D1 · Lỗi: 1/);
  assert.match(combined, /Tổng lỗi nhóm: 1/);
  assert.doesNotMatch(combined, /timeout|stack|ECONN|exception/i);
});
