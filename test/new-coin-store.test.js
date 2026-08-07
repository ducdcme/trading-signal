import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addNewCoinEntry, deleteNewCoinEntry, loadNewCoinList, normalizeNewCoinEntry, setNewCoinPaused } from "../lib/new-coin-store.js";

test("normalizes and pins a new coin to an explicit exchange and pair", () => {
  const now = Date.UTC(2026, 7, 6);
  const entry = normalizeNewCoinEntry({ exchange: "okx", instrumentId: "hypeusdt" }, now);
  assert.deepEqual(entry, {
    id: "OKX:HYPE-USDT", asset: "HYPE", exchange: "OKX", instrumentId: "HYPE-USDT", quote: "USDT",
    paused: false, addedAt: now, updatedAt: now
  });
  assert.throws(() => normalizeNewCoinEntry({ exchange: "AUTO", instrumentId: "HYPE" }, now), /chọn sàn cụ thể/);
});

test("new coin watchlist persists without an expiry time", async () => {
  const directory = await mkdtemp(join(tmpdir(), "trading-signal-new-coins-"));
  const path = join(directory, "new-coins.json");
  const now = Date.UTC(2026, 7, 6);
  await addNewCoinEntry(path, { exchange: "BINANCE", instrumentId: "HYPEUSDT" }, now);
  const loadedYearsLater = await loadNewCoinList(path, now + 10 * 365 * 86_400_000);
  assert.equal(loadedYearsLater.items.length, 1);
  assert.equal(loadedYearsLater.items[0].addedAt, now);
  assert.equal("expiresAt" in loadedYearsLater.items[0], false);
});

test("new coin watchlist rejects the same pinned pair twice", async () => {
  const directory = await mkdtemp(join(tmpdir(), "trading-signal-new-coins-"));
  const path = join(directory, "new-coins.json");
  await addNewCoinEntry(path, { exchange: "BYBIT", instrumentId: "HYPEUSDT" }, 1000);
  await assert.rejects(addNewCoinEntry(path, { exchange: "BYBIT", instrumentId: "HYPEUSDT" }, 2000), error => error.code === "NEW_COIN_EXISTS");
  assert.equal((await loadNewCoinList(path)).items.length, 1);
});

test("new coin watchlist supports persistent pause, resume and delete", async () => {
  const directory = await mkdtemp(join(tmpdir(), "trading-signal-new-coins-"));
  const path = join(directory, "new-coins.json");
  const entry = await addNewCoinEntry(path, { exchange: "GATE", instrumentId: "HYPE_USDT" }, 1000);
  assert.equal((await setNewCoinPaused(path, entry.id, true, 2000)).paused, true);
  assert.equal((await loadNewCoinList(path)).items[0].paused, true);
  assert.equal((await setNewCoinPaused(path, entry.id, false, 3000)).paused, false);
  assert.equal(await deleteNewCoinEntry(path, entry.id), true);
  assert.equal((await JSON.parse(await readFile(path, "utf8"))).items.length, 0);
  assert.equal(await deleteNewCoinEntry(path, entry.id), false);
});
