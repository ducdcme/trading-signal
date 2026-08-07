import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFocusConfig } from "../lib/focus-config.js";

test("focus config defaults to 4H and 8H with 4H selected", () => {
  const config = normalizeFocusConfig();
  assert.deepEqual(config.timeframes, ["4H", "8H"]);
  assert.equal(config.defaultTimeframe, "4H");
});

test("focus config accepts supported timeframes and sanitizes schedule values", () => {
  const config = normalizeFocusConfig({ timeframes: ["8h", "4H", "bad"], defaultTimeframe: "8H", retentionDays: 12, scanHours: [23, 7, 7, 99] });
  assert.deepEqual(config, { timeframes: ["8H", "4H"], defaultTimeframe: "8H", retentionDays: 12, scanHours: [7, 23] });
});
