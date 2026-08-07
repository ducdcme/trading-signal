import test from "node:test";
import assert from "node:assert/strict";
import { dueAutomationJobs, normalizeAutomationRuntimeConfig } from "../lib/automation-schedule.js";

const settings = {
  enabled: true,
  schedules: {
    cryptoDaily: { enabled: true, time: "07:10" },
    cryptoWeekly: { enabled: false, day: 1, time: "07:15" },
    focusScan: { enabled: true, minute: 5 },
    newCoinScan: { enabled: true }
  }
};

const config = {
  focus: { scanHours: [3, 7, 11, 15, 19, 23] },
  newCoins: { timeframe: "8H", scanHours: [7, 15, 23], scanMinute: 5 }
};

test("normalizes fixed scheduler timing from config.json", () => {
  assert.deepEqual(normalizeAutomationRuntimeConfig({ timezone: "Asia/Ho_Chi_Minh", schedulerPollSeconds: 20 }), {
    timezone: "Asia/Ho_Chi_Minh", schedulerPollSeconds: 20
  });
  assert.deepEqual(normalizeAutomationRuntimeConfig({ timezone: "Bad/Timezone", schedulerPollSeconds: 2 }), {
    timezone: "Asia/Ho_Chi_Minh", schedulerPollSeconds: 30
  });
});

test("scheduler dispatch plan includes Coin mới 8H at the configured time", () => {
  const jobs = dueAutomationJobs({ date: "2026-08-07", time: "07:05", day: 5 }, settings, config);
  assert.deepEqual(jobs.map(job => job.timeframe).sort(), ["FOCUS", "NEW_COIN"]);
});

test("scheduler does not dispatch Coin mới when master or its schedule is disabled", () => {
  assert.deepEqual(dueAutomationJobs({ date: "2026-08-07", time: "07:05", day: 5 }, { ...settings, enabled: false }, config), []);
  const disabled = { ...settings, schedules: { ...settings.schedules, newCoinScan: { enabled: false } } };
  assert.equal(dueAutomationJobs({ date: "2026-08-07", time: "07:05", day: 5 }, disabled, config).some(job => job.timeframe === "NEW_COIN"), false);
});
