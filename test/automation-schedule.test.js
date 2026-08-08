import test from "node:test";
import assert from "node:assert/strict";
import { dueAutomationJobs, normalizeAutomationRuntimeConfig } from "../lib/automation-schedule.js";

const settings = {
  enabled: true,
  schedules: {
    cryptoDaily: { enabled: true, time: "07:10" },
    cryptoWeekly: { enabled: false, day: 1, time: "07:15" },
    closedCandle: { minute: 5 },
    focusScan: { enabled: true },
    newCoinScan: { enabled: true },
    dex4h: { enabled: true },
    dex8h: { enabled: true }
  }
};

const config = {
  focus: { scanHours: [3, 7, 11, 15, 19, 23] },
  newCoins: { timeframe: "8H", scanHours: [7, 15, 23], scanMinute: 5 },
  dex: { alerts: { scanMinute: 10, closeHours: { "4H": [3, 7, 11, 15, 19, 23], "8H": [7, 15, 23] } } }
};

test("normalizes fixed scheduler timing from config.json", () => {
  assert.deepEqual(normalizeAutomationRuntimeConfig({ timezone: "Asia/Ho_Chi_Minh", schedulerPollSeconds: 20 }), {
    timezone: "Asia/Ho_Chi_Minh", schedulerPollSeconds: 20
  });
  assert.deepEqual(normalizeAutomationRuntimeConfig({ timezone: "Bad/Timezone", schedulerPollSeconds: 2 }), {
    timezone: "Asia/Ho_Chi_Minh", schedulerPollSeconds: 30
  });
});

test("scheduler dispatches DEX 4H and 8H with the shared closed-candle delay", () => {
  const both = dueAutomationJobs({ date: "2026-08-07", time: "07:05", day: 5 }, settings, config).filter(job => job.assetGroup === "dex");
  assert.deepEqual(both.map(job => job.timeframe), ["8H", "4H"]);
  const fourHourOnly = dueAutomationJobs({ date: "2026-08-07", time: "11:05", day: 5 }, settings, config).filter(job => job.assetGroup === "dex");
  assert.deepEqual(fourHourOnly.map(job => job.timeframe), ["4H"]);
  assert.equal(dueAutomationJobs({ date: "2026-08-07", time: "11:04", day: 5 }, settings, config).some(job => job.assetGroup === "dex"), false);
});

test("scheduler groups all small-timeframe jobs at the shared 8H close slot", () => {
  const jobs = dueAutomationJobs({ date: "2026-08-07", time: "07:05", day: 5 }, settings, config);
  assert.deepEqual(jobs.map(job => job.timeframe).sort(), ["4H", "8H", "FOCUS", "NEW_COIN"]);
});

test("scheduler does not dispatch Coin mới when master or its schedule is disabled", () => {
  assert.deepEqual(dueAutomationJobs({ date: "2026-08-07", time: "07:05", day: 5 }, { ...settings, enabled: false }, config), []);
  const disabled = { ...settings, schedules: { ...settings.schedules, newCoinScan: { enabled: false } } };
  assert.equal(dueAutomationJobs({ date: "2026-08-07", time: "07:05", day: 5 }, disabled, config).some(job => job.timeframe === "NEW_COIN"), false);
});
