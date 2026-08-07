import test from "node:test";
import assert from "node:assert/strict";
import { localClock, normalizeAutomation } from "../lib/automation-store.js";
import { splitTelegramText } from "../lib/telegram.js";
import { selectDeliverySignals, signalKey } from "../lib/automation-signals.js";
import { groupDirectionalSignals, signalDisplayName } from "../lib/signal-groups.js";

test("migrates version 1 automation settings to the multi-asset schema", () => {
  const settings = normalizeAutomation({
    enabled: true,
    chatId: " -100123 ",
    daily: { enabled: true, time: "07:20" },
    weekly: { enabled: true, day: 1, time: "07:30" },
    cexSymbols: ["BTC", "BTC", "ETH"],
    dexTokens: [{ network: "BASE", tokenAddress: "0xabc" }]
  });
  assert.equal(settings.schemaVersion, 4);
  assert.equal(settings.telegram.chatId, "-100123");
  assert.deepEqual(settings.assets.cex.watchlist, ["BTC", "ETH"]);
  assert.equal(settings.assets.dex.watchlist[0].network, "base");
  assert.equal(settings.schedules.cryptoWeekly.day, 1);
  assert.equal(settings.assets.stocks.enabled, false);
  assert.deepEqual(settings.assets.stocks.watchlist, []);
  assert.deepEqual(settings.schedules.focusScan, { enabled: true, minute: 5 });
  assert.deepEqual(settings.schedules.newCoinScan, { enabled: true });
});

test("keeps stock placeholders and independent schedules in version 2", () => {
  const settings = normalizeAutomation({
    schemaVersion: 2,
    assets: { stocks: { enabled: false, watchlist: ["fpt", "HOSE:HPG"] } },
    schedules: { stockDaily: { enabled: false, time: "15:30" }, stockWeekly: { enabled: false, day: 5, time: "15:35" } }
  });
  assert.deepEqual(settings.assets.stocks.watchlist, ["FPT", "HOSE:HPG"]);
  assert.deepEqual(settings.schedules.stockDaily, { enabled: false, time: "15:30" });
  assert.deepEqual(settings.schedules.stockWeekly, { enabled: false, day: 5, time: "15:35" });
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
