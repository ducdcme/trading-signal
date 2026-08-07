import test from "node:test";
import assert from "node:assert/strict";
import { CHART_TIME_ZONE, formatChartDate } from "../public/chart-time.js";

test("formats intraday candle times in Viet Nam timezone", () => {
  assert.equal(CHART_TIME_ZONE, "Asia/Ho_Chi_Minh");
  assert.match(formatChartDate(Date.UTC(2026, 7, 5, 12), "4H"), /19:00/);
  assert.match(formatChartDate(Date.UTC(2026, 7, 5, 16), "4H"), /23:00/);
  assert.match(formatChartDate(Date.UTC(2026, 7, 5, 0), "8H"), /07:00/);
  assert.match(formatChartDate(Date.UTC(2026, 7, 5, 8), "8H"), /15:00/);
  assert.match(formatChartDate(Date.UTC(2026, 7, 5, 16), "8H"), /23:00/);
});

test("keeps daily labels date-only", () => {
  assert.doesNotMatch(formatChartDate(Date.UTC(2026, 7, 5), "1D"), /\d{2}:\d{2}/);
});
