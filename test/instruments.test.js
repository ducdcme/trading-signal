import test from "node:test";
import assert from "node:assert/strict";
import { parseInstrument, parseInstruments } from "../lib/instruments.js";

test("bare coin uses automatic exchange discovery", () => {
  assert.deepEqual(parseInstrument("MNT"), { exchange: "AUTO", instrumentId: "MNT", key: "MNT" });
});

test("formats explicit exchange instruments", () => {
  assert.equal(parseInstrument("BYBIT:MNT").instrumentId, "MNTUSDT");
  assert.equal(parseInstrument("OKX:PI").instrumentId, "PI-USDT");
  assert.equal(parseInstrument("BYBIT:ABCUSDC").instrumentId, "ABCUSDC");
  assert.equal(parseInstrument("OKX:ABC-USDC").instrumentId, "ABC-USDC");
});

test("deduplicates the same requested instrument", () => {
  assert.equal(parseInstruments(["PI", "PIUSDT"]).length, 1);
});
