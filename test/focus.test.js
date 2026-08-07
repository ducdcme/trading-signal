import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deleteFocusEntry, extendFocusEntry, loadFocusList, normalizeFocusEntry, upsertFocusEntry } from "../lib/focus-store.js";

test("normalizes a seven-day focus entry and migrates legacy 1H to configured 4H", () => {
  const now = Date.UTC(2026, 7, 4);
  const entry = normalizeFocusEntry({ asset: "btc", exchange: "binance", instrumentId: "BTCUSDT", direction: "buy", timeframe: "1H" }, now);
  assert.equal(entry.asset, "BTC");
  assert.equal(entry.direction, "BUY");
  assert.equal(entry.timeframe, "4H");
  assert.equal(entry.expiresAt - now, 7 * 86_400_000);
});

test("upsert keeps one focus entry per coin and supports extend/delete", async () => {
  const directory = await mkdtemp(join(tmpdir(), "trading-signal-focus-"));
  const path = join(directory, "focus.json");
  const now = Date.UTC(2026, 7, 4);
  await upsertFocusEntry(path, { asset: "BTC", exchange: "BINANCE", instrumentId: "BTCUSDT", direction: "BUY", timeframe: "8H" }, now);
  await upsertFocusEntry(path, { asset: "BTC", exchange: "BINANCE", instrumentId: "BTCUSDT", direction: "SELL", timeframe: "4H" }, now + 1000);
  const loaded = await loadFocusList(path, now + 1000);
  assert.equal(loaded.items.length, 1);
  assert.equal(loaded.items[0].direction, "SELL");
  assert.equal(loaded.items[0].timeframe, "4H");
  const extended = await extendFocusEntry(path, "BTC", now + 2000);
  assert.equal(extended.expiresAt, now + 2000 + 7 * 86_400_000);
  assert.equal(await deleteFocusEntry(path, "BTC"), true);
  assert.equal((await JSON.parse(await readFile(path, "utf8"))).items.length, 0);
});

test("loading an expired entry does not silently renew it", () => {
  const now = Date.UTC(2026, 7, 4);
  const expired = normalizeFocusEntry({ asset: "ETH", exchange: "OKX", instrumentId: "ETH-USDT", direction: "BUY", timeframe: "1H", expiresAt: now - 1 }, now);
  assert.equal(expired.expiresAt, now - 1);
});
