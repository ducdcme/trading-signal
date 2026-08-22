import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { METAL_ALERT_PRODUCTS } from "./metals.js";

export const AUTOMATION_SCHEMA_VERSION = 7;

export const DEFAULT_AUTOMATION = Object.freeze({
  schemaVersion: AUTOMATION_SCHEMA_VERSION,
  enabled: false,
  timezone: "Asia/Ho_Chi_Minh",
  telegram: { chatId: "", sendNoSignalSummary: true, sendErrors: false },
  assets: {
    cex: { enabled: true, watchlist: [] },
    dex: { enabled: true, watchlist: [] },
    metals: { enabled: true, products: METAL_ALERT_PRODUCTS, side: "SELL" },
    stocks: { enabled: false, watchlist: [], provider: "SSI" }
  },
  schedules: {
    cryptoDaily: { enabled: true, time: "07:10" },
    cryptoWeekly: { enabled: false, day: 1, time: "07:15" },
    closedCandle: { minute: 5 },
    focusScan: { enabled: true },
    newCoinScan: { enabled: true },
    dex4h: { enabled: false },
    dex8h: { enabled: false },
    metalsDaily: { enabled: false, time: "07:10" },
    stockDaily: { enabled: false, time: "15:30" },
    stockWeekly: { enabled: false, day: 5, time: "15:35" }
  }
});

const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));
const uniqueStrings = (values, limit) => [...new Set((Array.isArray(values) ? values : []).map(value => String(value).trim()).filter(Boolean))].slice(0, limit);

function normalizeDaily(input, fallback) {
  return { enabled: input?.enabled !== false, time: validTime(input?.time) ? input.time : fallback.time };
}

function normalizeWeekly(input, fallback) {
  const day = Number(input?.day);
  return {
    enabled: Boolean(input?.enabled),
    day: Number.isInteger(day) && day >= 1 && day <= 7 ? day : fallback.day,
    time: validTime(input?.time) ? input.time : fallback.time
  };
}

function normalizeClosedCandleSchedule(input, legacyFocus) {
  const minute = Number(input?.minute ?? legacyFocus?.minute);
  return { minute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : 5 };
}

export function normalizeAutomation(input = {}) {
  // Version 1 used flat chatId/daily/weekly/cexSymbols/dexTokens fields.
  // Reading both shapes keeps existing server installations upgrade-safe.
  const cex = input.assets?.cex;
  const dex = input.assets?.dex;
  const metals = input.assets?.metals;
  const stocks = input.assets?.stocks;
  const telegram = input.telegram;
  const cryptoDaily = input.schedules?.cryptoDaily ?? input.daily;
  const cryptoWeekly = input.schedules?.cryptoWeekly ?? input.weekly;

  return {
    schemaVersion: AUTOMATION_SCHEMA_VERSION,
    enabled: Boolean(input.enabled),
    timezone: DEFAULT_AUTOMATION.timezone,
    telegram: {
      chatId: String(telegram?.chatId ?? input.chatId ?? "").trim().slice(0, 100),
      sendNoSignalSummary: (telegram?.sendNoSignalSummary ?? input.sendNoSignalSummary) !== false,
      // Kept in the persisted schema for upgrade compatibility. Detailed scan
      // errors are always written to server logs, never copied to Telegram.
      sendErrors: false
    },
    assets: {
      cex: { enabled: cex?.enabled !== false, watchlist: uniqueStrings(cex?.watchlist ?? input.cexSymbols, 1000) },
      dex: {
        enabled: dex?.enabled !== false,
        watchlist: (Array.isArray(dex?.watchlist ?? input.dexTokens) ? (dex?.watchlist ?? input.dexTokens) : [])
          .map(item => ({
            network: String(item.network ?? "").trim().toLowerCase(),
            tokenAddress: String(item.tokenAddress ?? "").trim(),
            ...(String(item.poolAddress ?? "").trim() ? { poolAddress: String(item.poolAddress).trim() } : {})
          }))
          .filter(item => item.network && item.tokenAddress)
          .slice(0, 500)
      },
      metals: {
        enabled: metals?.enabled !== false,
        products: [...METAL_ALERT_PRODUCTS],
        side: "SELL"
      },
      stocks: {
        enabled: Boolean(stocks?.enabled),
        watchlist: uniqueStrings(stocks?.watchlist, 1000).map(value => value.toUpperCase()),
        provider: "SSI"
      }
    },
    schedules: {
      cryptoDaily: normalizeDaily(cryptoDaily, DEFAULT_AUTOMATION.schedules.cryptoDaily),
      cryptoWeekly: normalizeWeekly(cryptoWeekly, DEFAULT_AUTOMATION.schedules.cryptoWeekly),
      closedCandle: normalizeClosedCandleSchedule(input.schedules?.closedCandle, input.schedules?.focusScan),
      focusScan: { enabled: input.schedules?.focusScan?.enabled !== false },
      newCoinScan: { enabled: input.schedules?.newCoinScan?.enabled !== false },
      dex4h: { enabled: Boolean(input.schedules?.dex4h?.enabled) },
      dex8h: { enabled: Boolean(input.schedules?.dex8h?.enabled) },
      metalsDaily: normalizeDaily(input.schedules?.metalsDaily ?? { enabled: false }, DEFAULT_AUTOMATION.schedules.metalsDaily),
      stockDaily: normalizeDaily(input.schedules?.stockDaily ?? { enabled: false }, DEFAULT_AUTOMATION.schedules.stockDaily),
      stockWeekly: normalizeWeekly(input.schedules?.stockWeekly, DEFAULT_AUTOMATION.schedules.stockWeekly)
    }
  };
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

export async function loadAutomation(path) {
  return normalizeAutomation(await readJson(path, DEFAULT_AUTOMATION));
}

export async function saveAutomation(path, value) {
  const normalized = normalizeAutomation(value);
  await writeJson(path, normalized);
  return normalized;
}

export async function loadAutomationState(path) {
  return readJson(path, { schemaVersion: AUTOMATION_SCHEMA_VERSION, sentKeys: [], lastRuns: {}, lastSlots: {} });
}

export async function saveAutomationState(path, state) {
  const safe = {
    schemaVersion: AUTOMATION_SCHEMA_VERSION,
    sentKeys: [...new Set(Array.isArray(state.sentKeys) ? state.sentKeys : [])].slice(-5000),
    lastRuns: state.lastRuns && typeof state.lastRuns === "object" ? state.lastRuns : {},
    lastSlots: state.lastSlots && typeof state.lastSlots === "object" ? state.lastSlots : {}
  };
  await writeJson(path, safe);
  return safe;
}

export function localClock(date, timezone = DEFAULT_AUTOMATION.timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short"
  }).formatToParts(date).reduce((all, item) => ({ ...all, [item.type]: item.value }), {});
  const weekdays = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, day: weekdays[parts.weekday] };
}
