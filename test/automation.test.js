import test from "node:test";
import assert from "node:assert/strict";
import { localClock, normalizeAutomation } from "../lib/automation-store.js";
import { splitTelegramText } from "../lib/telegram.js";
import { selectDeliverySignals, signalKey } from "../lib/automation-signals.js";

test("migrates version 1 automation settings to the multi-asset schema", () => {
  const settings = normalizeAutomation({
    enabled: true,
    chatId: " -100123 ",
    daily: { enabled: true, time: "07:20" },
    weekly: { enabled: true, day: 1, time: "07:30" },
    cexSymbols: ["BTC", "BTC", "ETH"],
    dexTokens: [{ network: "BASE", tokenAddress: "0xabc" }]
  });
  assert.equal(settings.schemaVersion, 3);
  assert.equal(settings.telegram.chatId, "-100123");
  assert.deepEqual(settings.assets.cex.watchlist, ["BTC", "ETH"]);
  assert.equal(settings.assets.dex.watchlist[0].network, "base");
  assert.equal(settings.schedules.cryptoWeekly.day, 1);
  assert.equal(settings.assets.stocks.enabled, false);
  assert.deepEqual(settings.assets.stocks.watchlist, []);
  assert.deepEqual(settings.schedules.focusScan, { enabled: true, minute: 5 });
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
