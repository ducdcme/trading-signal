import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { normalizeFocusConfig } from "./focus-config.js";

export const FOCUS_DAYS = 7;
const VALID_EXCHANGES = new Set(["BINANCE", "OKX", "BYBIT", "BITGET", "KUCOIN", "GATE", "MEXC"]);

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

export function normalizeFocusEntry(input, now = Date.now(), settings = undefined) {
  const focus = normalizeFocusConfig(settings);
  const asset = String(input.asset ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const exchange = String(input.exchange ?? "").trim().toUpperCase();
  const instrumentId = String(input.instrumentId ?? "").trim().toUpperCase();
  const direction = String(input.direction ?? "").trim().toUpperCase();
  const requestedTimeframe = String(input.timeframe || "").toUpperCase();
  const timeframe = focus.timeframes.includes(requestedTimeframe) ? requestedTimeframe : focus.defaultTimeframe;
  if (!asset) throw new Error("Thiếu mã coin");
  if (!VALID_EXCHANGES.has(exchange)) throw new Error("Sàn theo dõi không hợp lệ");
  if (!instrumentId) throw new Error("Thiếu instrument của sàn");
  if (!["BUY", "SELL"].includes(direction)) throw new Error("Chiều theo dõi phải là BUY hoặc SELL");
  const addedAt = Number(input.addedAt) || now;
  const rawExpiresAt = Number(input.expiresAt);
  const expiresAt = Number.isFinite(rawExpiresAt) && rawExpiresAt > 0 ? rawExpiresAt : now + focus.retentionDays * 86_400_000;
  return { id: asset, asset, exchange, instrumentId, direction, timeframe, addedAt, expiresAt };
}

export async function loadFocusList(path, now = Date.now(), settings = undefined) {
  const data = await readJson(path, { schemaVersion: 1, items: [] });
  const items = [];
  for (const item of Array.isArray(data.items) ? data.items : []) {
    try { items.push(normalizeFocusEntry(item, now, settings)); } catch { /* bỏ bản ghi runtime hỏng */ }
  }
  return { schemaVersion: 1, items };
}

export async function saveFocusList(path, items, settings = undefined) {
  const normalized = items.map(item => normalizeFocusEntry(item, Date.now(), settings));
  await writeJson(path, { schemaVersion: 1, items: normalized });
  return normalized;
}

export async function upsertFocusEntry(path, input, now = Date.now(), settings = undefined) {
  const focus = normalizeFocusConfig(settings);
  const data = await loadFocusList(path, now, focus);
  const entry = normalizeFocusEntry({ ...input, addedAt: now, expiresAt: now + focus.retentionDays * 86_400_000 }, now, focus);
  const items = data.items.filter(item => item.asset !== entry.asset);
  items.push(entry);
  await saveFocusList(path, items, focus);
  return entry;
}

export async function deleteFocusEntry(path, asset, settings = undefined) {
  const data = await loadFocusList(path, Date.now(), settings);
  const target = String(asset).toUpperCase();
  const items = data.items.filter(item => item.asset !== target);
  if (items.length === data.items.length) return false;
  await saveFocusList(path, items, settings);
  return true;
}

export async function extendFocusEntry(path, asset, now = Date.now(), settings = undefined) {
  const focus = normalizeFocusConfig(settings);
  const data = await loadFocusList(path, now, focus);
  const target = data.items.find(item => item.asset === String(asset).toUpperCase());
  if (!target) throw new Error("Coin không còn trong danh sách theo dõi");
  target.addedAt = now;
  target.expiresAt = now + focus.retentionDays * 86_400_000;
  await saveFocusList(path, data.items, focus);
  return target;
}
