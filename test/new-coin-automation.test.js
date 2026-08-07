import test from "node:test";
import assert from "node:assert/strict";
import { activeNewCoinItems, formatNewCoinReport } from "../lib/new-coin-automation.js";
import { isNewCoinScheduleDue, normalizeNewCoinConfig } from "../lib/new-coin-config.js";
import { selectDeliverySignals, signalKey } from "../lib/automation-signals.js";

test("normalizes the 8H new-coin schedule from config.json values", () => {
  assert.deepEqual(normalizeNewCoinConfig({ timeframe: "8h", scanHours: [23, 7, 15, 7, 99], scanMinute: 5 }), {
    timeframe: "8H", exchangePriority: ["BINANCE", "OKX", "BYBIT"], scanHours: [7, 15, 23], scanMinute: 5, minimumCandles: 61
  });
  assert.deepEqual(normalizeNewCoinConfig({ timeframe: "1H", scanHours: [], scanMinute: 99 }), {
    timeframe: "8H", exchangePriority: ["BINANCE", "OKX", "BYBIT"], scanHours: [7, 15, 23], scanMinute: 5, minimumCandles: 61
  });
});

test("normalizes automatic new-coin exchange discovery to Binance, OKX and Bybit", () => {
  assert.deepEqual(normalizeNewCoinConfig({ exchangePriority: ["binance", "OKX", "BYBIT", "MEXC"] }).exchangePriority, ["BINANCE", "OKX", "BYBIT"]);
  assert.deepEqual(normalizeNewCoinConfig({ exchangePriority: [] }).exchangePriority, ["BINANCE", "OKX", "BYBIT"]);
});

test("runs the new-coin scheduler only at configured Viet Nam clock slots", () => {
  const config = { timeframe: "8H", scanHours: [7, 15, 23], scanMinute: 5 };
  assert.equal(isNewCoinScheduleDue({ time: "07:05" }, { enabled: true }, config), true);
  assert.equal(isNewCoinScheduleDue({ time: "15:05" }, { enabled: true }, config), true);
  assert.equal(isNewCoinScheduleDue({ time: "23:05" }, { enabled: true }, config), true);
  assert.equal(isNewCoinScheduleDue({ time: "07:04" }, { enabled: true }, config), false);
  assert.equal(isNewCoinScheduleDue({ time: "07:05" }, { enabled: false }, config), false);
});

test("paused new coins are excluded before scanning", () => {
  const items = [{ id: "BINANCE:AUSDT", paused: false }, { id: "OKX:B-USDT", paused: true }];
  assert.deepEqual(activeNewCoinItems(items), [items[0]]);
});

test("new-coin delivery deduplicates the same closed 8H signal", () => {
  const row = {
    assetType: "NEW_COIN", exchange: "BINANCE", instrumentId: "AUSDT",
    candleOpenTime: 100, status: "BUY", buySignalTypes: ["B"]
  };
  const key = signalKey(row, "NEW_COIN:8H");
  const result = selectDeliverySignals([row], [key], "NEW_COIN:8H", "schedule");
  assert.equal(result.delivered.length, 0);
  assert.equal(result.suppressed, 1);
});

test("new-coin Telegram report exposes error types and counts but not details", () => {
  const rows = [
    { assetType: "NEW_COIN", exchange: "BINANCE", instrumentId: "AUSDT", status: "ERROR", error: "secret A timeout" },
    { assetType: "NEW_COIN", exchange: "OKX", instrumentId: "BUSDT", status: "ERROR", error: "private B timeout" }
  ];
  const report = formatNewCoinReport(rows, { delivered: [], suppressed: 0, paused: 3 }, { timezone: "Asia/Ho_Chi_Minh", telegram: { sendNoSignalSummary: true } }, "schedule");
  assert.match(report, /Tạm dừng: 3 · Lỗi: 2/);
  assert.match(report, /Loại lỗi: Timeout: 2/);
  assert.doesNotMatch(report, /secret A|private B|AUSDT|BUSDT/);
});
