import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseInstrument } from "./instruments.js";

export const MAX_NEW_COINS = 200;

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

export function normalizeNewCoinEntry(input, now = Date.now()) {
  const exchange = String(input.exchange ?? "").trim().toUpperCase();
  const instrumentId = String(input.instrumentId ?? input.symbol ?? "").trim().toUpperCase();
  if (!exchange || exchange === "AUTO") throw new Error("Coin mới phải chọn sàn cụ thể");
  if (!instrumentId) throw new Error("Thiếu cặp giao dịch");
  const instrument = parseInstrument(`${exchange}:${instrumentId}`);
  const addedAt = Number(input.addedAt) || now;
  const updatedAt = Number(input.updatedAt) || addedAt;
  return {
    id: `${instrument.exchange}:${instrument.instrumentId}`,
    asset: instrument.asset,
    exchange: instrument.exchange,
    instrumentId: instrument.instrumentId,
    quote: instrument.quote,
    paused: input.paused === true,
    addedAt,
    updatedAt
  };
}

export async function loadNewCoinList(path, now = Date.now()) {
  const data = await readJson(path, { schemaVersion: 1, items: [] });
  const items = [];
  for (const item of Array.isArray(data.items) ? data.items : []) {
    try { items.push(normalizeNewCoinEntry(item, now)); } catch { /* bỏ bản ghi runtime hỏng */ }
  }
  return { schemaVersion: 1, items };
}

export async function saveNewCoinList(path, items) {
  const normalized = items.map(item => normalizeNewCoinEntry(item));
  await writeJson(path, { schemaVersion: 1, items: normalized });
  return normalized;
}

export async function addNewCoinEntry(path, input, now = Date.now()) {
  const data = await loadNewCoinList(path, now);
  const entry = normalizeNewCoinEntry({ ...input, paused: false, addedAt: now, updatedAt: now }, now);
  if (data.items.some(item => item.id === entry.id)) {
    const error = new Error("Cặp giao dịch đã có trong danh sách Coin mới");
    error.code = "NEW_COIN_EXISTS";
    throw error;
  }
  if (data.items.length >= MAX_NEW_COINS) throw new Error(`Danh sách Coin mới tối đa ${MAX_NEW_COINS} cặp`);
  await saveNewCoinList(path, [...data.items, entry]);
  return entry;
}

export async function setNewCoinPaused(path, id, paused, now = Date.now()) {
  const data = await loadNewCoinList(path, now);
  const target = data.items.find(item => item.id === String(id).toUpperCase());
  if (!target) return null;
  target.paused = paused === true;
  target.updatedAt = now;
  await saveNewCoinList(path, data.items);
  return target;
}

export async function deleteNewCoinEntry(path, id) {
  const data = await loadNewCoinList(path);
  const target = String(id).toUpperCase();
  const items = data.items.filter(item => item.id !== target);
  if (items.length === data.items.length) return false;
  await saveNewCoinList(path, items);
  return true;
}
