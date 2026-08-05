import test from "node:test";
import assert from "node:assert/strict";
import { formatScanErrorSummary, scanErrorType, summarizeScanErrors } from "../lib/scan-errors.js";

test("classifies technical exchange failures without exposing details", () => {
  assert.equal(scanErrorType("The operation was aborted due to timeout"), "Timeout");
  assert.equal(scanErrorType("429 Too many requests"), "Rate limit");
  assert.equal(scanErrorType("503 Service unavailable"), "API 5xx");
  assert.equal(scanErrorType("fetch failed: ECONNRESET"), "Lỗi mạng");
});

test("summarizes only error rows by type and count", () => {
  const rows = [
    { status: "ERROR", error: "KNC Binance timeout after 15 seconds" },
    { status: "ERROR", error: "ARK secret endpoint timed out" },
    { status: "ERROR", error: "429 Too many requests from private URL" },
    { status: "BUY", error: "must not be counted" }
  ];
  assert.deepEqual(summarizeScanErrors(rows), [
    { type: "Timeout", count: 2 },
    { type: "Rate limit", count: 1 }
  ]);
  assert.equal(formatScanErrorSummary(rows), "Timeout: 2 · Rate limit: 1");
  assert.doesNotMatch(formatScanErrorSummary(rows), /KNC|ARK|private URL/);
});
