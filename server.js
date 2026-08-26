import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseInstruments } from "./lib/instruments.js";
import { resolveAndFetchClosedCandles, resolveFocusCandles } from "./lib/market.js";
import { calculateSignals } from "./lib/indicator.js";
import { candlesForTimeframe } from "./lib/candles.js";
import { discoverDexPoolOptions, fetchDexCandles } from "./lib/geckoterminal.js";
import { loadEnvFile } from "./lib/env.js";
import { loadAutomation, loadAutomationState, localClock, normalizeAutomation, saveAutomation, saveAutomationState } from "./lib/automation-store.js";
import { findTelegramChats, sendTelegramText } from "./lib/telegram.js";
import { selectDeliverySignals } from "./lib/automation-signals.js";
import { clearSessionCookie, createSessionToken, isSameOrigin, loadAuthConfig, LoginRateLimiter, parseCookies, sessionCookie, verifyPassword, verifySessionToken } from "./lib/auth.js";
import { deleteFocusEntry, extendFocusEntry, loadFocusList, upsertFocusEntry } from "./lib/focus-store.js";
import { parseInstrument } from "./lib/instruments.js";
import { MarketNotFoundError } from "./lib/exchange-errors.js";
import { groupDirectionalSignals } from "./lib/signal-groups.js";
import { ema } from "./lib/ta.js";
import { fetchMarketQuote } from "./lib/quotes.js";
import { formatScanErrorSummary } from "./lib/scan-errors.js";
import { addNewCoinEntry, deleteNewCoinEntry, loadNewCoinList, setNewCoinPaused } from "./lib/new-coin-store.js";
import { resolveActiveSpotMarket } from "./lib/market-catalog.js";
import { normalizeFocusConfig } from "./lib/focus-config.js";
import { normalizeNewCoinConfig } from "./lib/new-coin-config.js";
import { activeNewCoinItems, formatNewCoinReport } from "./lib/new-coin-automation.js";
import { dueAutomationJobs, normalizeAutomationRuntimeConfig } from "./lib/automation-schedule.js";
import { formatAutomationReport, formatScheduledBatchReport } from "./lib/automation-report.js";
import { assertPinnedDexAlertTokens } from "./lib/dex-alerts.js";
import { buildMetalComparison, fetchMetalCandles, fetchMetalsLatest, METAL_ALERT_PRODUCTS, METAL_PRODUCTS } from "./lib/metals.js";
import { addStockInstrument, classifyStockPrepareResult, fetchStockCandles, fetchStockSymbols, fetchStockUniverseGroups, normalizeStockSymbol, parseStockSymbolList, removeStockInstrument, summarizeStockCandles, syncStockDaily } from "./lib/stocks.js";

const root = fileURLToPath(new URL(".", import.meta.url));
await loadEnvFile(join(root, ".env"));
const config = JSON.parse(await readFile(join(root, "config.json"), "utf8"));
config.focus = normalizeFocusConfig(config.focus);
config.newCoins = normalizeNewCoinConfig(config.newCoins);
config.automation = normalizeAutomationRuntimeConfig(config.automation);
const packageInfo = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const port = Number(process.env.PORT || 3210);
const host = process.env.HOST || "127.0.0.1";
const dataDir = resolve(root, process.env.DATA_DIR || "data");
const automationPath = join(dataDir, "automation.json");
const automationStatePath = join(dataDir, "automation-state.json");
const focusPath = join(dataDir, "focus-watchlist.json");
const newCoinPath = join(dataDir, "new-coin-watchlist.json");
const startedAt = Date.now();
const production = process.env.NODE_ENV === "production";
const metalsApi = {
  baseUrl: process.env.METALS_API_URL || "http://127.0.0.1:8787/",
  timeoutMs: Number(config.metals?.requestTimeoutMs) || 10_000
};
const stocksApi = {
  baseUrl: process.env.STOCKS_API_URL || "http://127.0.0.1:8790/",
  timeoutMs: Number(config.stocks?.requestTimeoutMs) || 10_000
};
const auth = loadAuthConfig();
if (production && !auth.enabled) throw new Error("Production bị khóa: hãy chạy npm run generate-auth và cấu hình AUTH_* trong .env");
if (!auth.enabled) console.warn("CẢNH BÁO: xác thực đang tắt vì chưa cấu hình AUTH_* (chỉ phù hợp phát triển local)");
const loginLimiter = new LoginRateLimiter();
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); };

function isHttps(req) {
  return Boolean(req.socket.encrypted) || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase() === "https";
}

function setSecurityHeaders(req, res) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("content-security-policy", "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'");
  if (isHttps(req)) res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
}

function hasSession(req) {
  if (!auth.enabled) return true;
  return Boolean(verifySessionToken(parseCookies(req.headers.cookie).ts_session, auth.username, auth.sessionSecret));
}

function clientKey(req) {
  return String(req.headers["x-real-ip"] || req.socket.remoteAddress || "unknown");
}

function redirect(res, location) {
  res.writeHead(302, { location, "cache-control": "no-store" });
  res.end();
}

async function readJsonBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 2 * 1024 * 1024) throw new Error("Dữ liệu gửi lên vượt quá 2 MB");
  }
  return body ? JSON.parse(body) : {};
}

async function mapLimited(items, limit, fn) {
  const output = Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await fn(items[index]);
    }
  }));
  return output;
}

function normalizeInstruments(input) {
  const base = Array.isArray(input) ? input : config.symbols;
  // CEX watchlists are discovery lists. TradingView exports include the chart
  // exchange (for example BINANCE:BLZUSDT), but that must not pin a delisted
  // market and bypass the configured exchange priority.
  return parseInstruments(base).map(item => parseInstrument(item.asset));
}

function analyzeCandles(dailyCandles, timeframe, minimumCandles = 100) {
  const candles = candlesForTimeframe(dailyCandles, timeframe);
  if (candles.length < minimumCandles) throw new Error(`Không đủ dữ liệu: chỉ có ${candles.length} nến ${timeframe}`);
  const signals = calculateSignals(candles);
  const candle = candles.at(-1);
  const found = groupDirectionalSignals(signals.at(-1));
  return { ...found, close: candle.close, candleOpenTime: candle.openTime, candleCloseTime: candle.closeTime, candleCount: candles.length };
}

function sourceTimeframeFor(timeframe) {
  if (timeframe === "8H") return "4H";
  if (timeframe === "1W") return "1D";
  return timeframe;
}

function chartPayload(candles, instrument, timeframe) {
  const generatedAt = Date.now();
  const selected = candlesForTimeframe(candles, timeframe, { includeOpen: true, now: generatedAt });
  const closedCount = selected.filter(candle => candle.closeTime < generatedAt).length;
  const signals = calculateSignals(selected.slice(0, closedCount)).map(groupDirectionalSignals);
  const closes = selected.map(candle => candle.close);
  const ema21 = ema(closes, 21);
  const ema55 = ema(closes, 55);
  return {
    generatedAt, closedBarsOnly: false, timeframe,
    market: { asset: instrument.asset, exchange: instrument.exchange, instrumentId: instrument.instrumentId, quote: instrument.quote },
    candles: selected.map((candle, index) => ({
      ...candle, ema21: ema21[index], ema55: ema55[index], isClosed: index < closedCount,
      ...(signals[index] || { status: "NONE", buySignalTypes: [], sellSignalTypes: [] })
    }))
  };
}

function logScanErrors(job, rows) {
  for (const row of rows.filter(item => item.status === "ERROR")) {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), job, asset: row.asset || row.symbol || row.instrumentId, exchange: row.exchange, error: row.error }));
  }
  for (const row of rows.filter(item => item.fallbackUsed)) {
    console.warn(JSON.stringify({ timestamp: new Date().toISOString(), job, asset: row.asset || row.symbol || row.instrumentId, exchange: row.exchange, fallbackUsed: true, sourceWarnings: row.sourceWarnings }));
  }
}

async function scan(instruments, timeframe) {
  return mapLimited(instruments, config.requestConcurrency, async instrument => {
    try {
      const sourceTimeframe = sourceTimeframeFor(timeframe);
      const resolved = await resolveAndFetchClosedCandles(instrument, sourceTimeframe, config.candleLimit, config.exchangePriority, config.quotePriority);
      const selected = resolved.instrument;
      return { assetType: "CEX", asset: selected.asset, symbol: selected.key, requestedSymbol: instrument.key, exchange: selected.exchange, instrumentId: selected.instrumentId, timeframe, ...analyzeCandles(resolved.candles, timeframe) };
    } catch (error) {
      const status = error instanceof MarketNotFoundError ? "SKIPPED" : "ERROR";
      return { assetType: "CEX", symbol: instrument.key, exchange: instrument.exchange, instrumentId: instrument.instrumentId, timeframe, status, error: error.message };
    }
  });
}

async function scanStocks(symbols) {
  const catalog = await fetchStockSymbols(stocksApi);
  const bySymbol = new Map(catalog.map(item => [item.symbol, item]));
  return mapLimited(symbols, Math.max(1, Math.min(config.requestConcurrency, 5)), async rawSymbol => {
    const symbol = normalizeStockSymbol(rawSymbol);
    const meta = bySymbol.get(symbol);
    if (!meta) return { assetType: "STOCK", symbol, instrumentId: symbol, exchange: "VN", timeframe: "1D", status: "SKIPPED", error: "Mã không có trong Stocks Data Collector" };
    try {
      const market = await fetchStockCandles(symbol, config.stocks.scanCandles || 500, stocksApi);
      return {
        assetType: "STOCK", asset: symbol, symbol, instrumentId: symbol, exchange: meta.exchange,
        name: meta.name, quote: "VND", provider: market.provider, timeframe: "1D",
        ...analyzeCandles(market.candles, "1D", config.stocks.minimumCandles || 100)
      };
    } catch (error) {
      return { assetType: "STOCK", symbol, instrumentId: symbol, exchange: meta.exchange, name: meta.name, timeframe: "1D", status: "ERROR", error: error.message };
    }
  });
}

async function resolveStockAutomationSymbols(settings) {
  const stocks = settings.assets?.stocks || {};
  const scopes = Array.isArray(stocks.scopes) && stocks.scopes.length ? stocks.scopes : ["WATCHLIST"];
  const catalog = await fetchStockSymbols(stocksApi);
  const active = new Set(catalog.map(item => item.symbol));
  const selected = new Set();
  if (scopes.includes("WATCHLIST")) {
    for (const symbol of stocks.watchlist || []) {
      const normalized = normalizeStockSymbol(symbol);
      if (active.has(normalized)) selected.add(normalized);
    }
  }
  const marketScopes = scopes.filter(scope => scope !== "WATCHLIST");
  if (marketScopes.length) {
    const groups = await fetchStockUniverseGroups(stocksApi);
    const byGroup = new Map(groups.map(group => [group.group, group]));
    for (const scope of marketScopes) {
      const group = byGroup.get(scope);
      if (!group) continue;
      for (const item of group.prepared || []) selected.add(item.symbol);
    }
  }
  return { scopes, symbols: [...selected] };
}

async function runStocksAutomation(trigger = "manual", options = {}) {
  const settings = effectiveAutomation(await loadAutomation(automationPath));
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Chưa cấu hình TELEGRAM_BOT_TOKEN trong .env");
  if (!settings.telegram.chatId) throw new Error("Chưa cấu hình Telegram Chat ID");
  if (!settings.assets.stocks.enabled) throw new Error("Cảnh báo Chứng khoán Việt Nam đang tắt");

  const selection = await resolveStockAutomationSymbols(settings);
  if (!selection.symbols.length) throw new Error("Stock automation chưa có mã prepared để quét");

  const runningState = await loadAutomationState(automationStatePath);
  runningState.lastRuns = {
    ...(runningState.lastRuns || {}),
    "stocks:1D": { at: Date.now(), assetGroup: "stocks", timeframe: "1D", trigger, scopes: selection.scopes, total: 0, detectedSignals: 0, sentSignals: 0, suppressedSignals: 0, errors: 0, synced: 0, freshCandles: 0, status: "RUNNING" }
  };
  await saveAutomationState(automationStatePath, runningState);

  const sync = await syncStockDaily(selection.symbols, { ...stocksApi, timeoutMs: Number(config.stocks.adminTimeoutMs) || 300_000 });
  const syncRows = Array.isArray(sync?.results) ? sync.results : [];
  const freshCandles = syncRows.reduce((total, row) => total + Number(row.fetched || 0), 0);
  const rows = await scanStocks(selection.symbols);
  const state = await loadAutomationState(automationStatePath);
  const delivery = selectDeliverySignals(rows, options.sentKeys ?? state.sentKeys, "1D", trigger);
  logScanErrors("stocks:1D", rows);
  const errors = rows.filter(row => row.status === "ERROR");
  const allFailed = rows.length > 0 && errors.length === rows.length;
  const shouldSend = delivery.delivered.length > 0 || settings.telegram.sendNoSignalSummary || allFailed;
  const scopeLabel = selection.scopes.join("+");
  const telegramText = shouldSend ? formatAutomationReport("1D", rows, delivery, settings, trigger, `CHỨNG KHOÁN VN · ${scopeLabel}`) : "";
  if (telegramText && options.deferTelegram !== true) await sendTelegramText(token, settings.telegram.chatId, telegramText);

  if (options.deferTelegram !== true) state.sentKeys = delivery.sentKeys;
  state.lastRuns = {
    ...(state.lastRuns || {}),
    "stocks:1D": {
      at: Date.now(), assetGroup: "stocks", timeframe: "1D", trigger, scopes: selection.scopes,
      total: rows.length, detectedSignals: delivery.detected.length, sentSignals: delivery.delivered.length,
      suppressedSignals: delivery.suppressed, errors: errors.length, synced: syncRows.length, freshCandles, status: "OK"
    }
  };
  await saveAutomationState(automationStatePath, state);
  return {
    timeframe: "1D", scopes: selection.scopes, total: rows.length,
    detectedSignals: delivery.detected.length, sentSignals: delivery.delivered.length,
    suppressedSignals: delivery.suppressed, errors: errors.length,
    synced: syncRows.length, freshCandles,
    messageSent: shouldSend && options.deferTelegram !== true, telegramText, sentKeys: delivery.sentKeys
  };
}

async function scanFocusItems(items) {
  return mapLimited(items, config.requestConcurrency, async item => {
    try {
      const resolved = await resolveFocusCandles(item, sourceTimeframeFor(item.timeframe), Math.min(config.candleLimit, 1000), config.exchangePriority, config.quotePriority);
      const selected = resolved.instrument;
      return {
        assetType: "FOCUS", symbol: item.asset, asset: item.asset,
        exchange: selected.exchange, instrumentId: selected.instrumentId,
        deliveryExchange: item.exchange, deliveryInstrumentId: item.instrumentId,
        fallbackUsed: resolved.fallbackUsed, sourceWarnings: resolved.sourceWarnings,
        timeframe: item.timeframe, expectedDirection: item.direction, expiresAt: item.expiresAt,
        ...analyzeCandles(resolved.candles, item.timeframe)
      };
    } catch (error) {
      return { assetType: "FOCUS", symbol: item.asset, exchange: item.exchange, instrumentId: item.instrumentId, timeframe: item.timeframe, expectedDirection: item.direction, expiresAt: item.expiresAt, status: "ERROR", error: error.message };
    }
  });
}

async function scanNewCoinItems(items) {
  return mapLimited(items, config.requestConcurrency, async item => {
    try {
      const instrument = parseInstrument(`${item.exchange}:${item.instrumentId}`);
      const resolved = await resolveAndFetchClosedCandles(
        instrument,
        sourceTimeframeFor(config.newCoins.timeframe),
        config.candleLimit,
        config.exchangePriority,
        config.quotePriority
      );
      return {
        assetType: "NEW_COIN",
        symbol: item.asset,
        asset: item.asset,
        exchange: item.exchange,
        instrumentId: item.instrumentId,
        timeframe: config.newCoins.timeframe,
        ...analyzeCandles(resolved.candles, config.newCoins.timeframe, config.newCoins.minimumCandles)
      };
    } catch (error) {
      return {
        assetType: "NEW_COIN",
        symbol: item.asset,
        asset: item.asset,
        exchange: item.exchange,
        instrumentId: item.instrumentId,
        timeframe: config.newCoins.timeframe,
        status: "ERROR",
        error: error.message
      };
    }
  });
}

function parseDexTokens(input) {
  const supported = new Set(config.dex.networks);
  const tokens = new Map();
  for (const item of Array.isArray(input) ? input : []) {
    const network = String(item.network ?? "").trim().toLowerCase();
    const tokenAddress = String(item.tokenAddress ?? "").trim();
    const poolAddress = String(item.poolAddress ?? "").trim();
    if (!supported.has(network)) throw new Error(`Mạng chưa được hỗ trợ: ${network}`);
    if (!/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{25,70})$/.test(tokenAddress)) throw new Error(`Token address không hợp lệ: ${tokenAddress}`);
    if (poolAddress && !/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{25,70})$/.test(poolAddress)) throw new Error(`Pool address không hợp lệ: ${poolAddress}`);
    tokens.set(`${network}:${tokenAddress}`, { network, tokenAddress, ...(poolAddress ? { poolAddress } : {}) });
  }
  return [...tokens.values()];
}

async function scanDex(tokens, timeframe) {
  return mapLimited(tokens, Math.max(1, Number(config.dex.scanConcurrency) || 1), async token => {
    try {
      if (timeframe === "1W" && !process.env.COINGECKO_API_KEY) throw new Error("W1 DEX cần CoinGecko Onchain Analyst API key");
      const requiredCandles = Number(config.dex.minimumCandles) || 100;
      const market = await fetchDexCandles(token, timeframe, { ...config.dex, apiKey: process.env.COINGECKO_API_KEY }, requiredCandles, false);
      return {
        assetType: "DEX", exchange: "GECKOTERMINAL", instrumentId: market.tokenSymbol,
        network: market.network, tokenAddress: market.tokenAddress, poolAddress: market.poolAddress,
        poolName: market.poolName, dex: market.dex, liquidityUsd: market.liquidityUsd, timeframe,
        quoteSymbol: market.quoteSymbol, poolPinned: market.poolPinned,
        suggestedPoolAddress: market.suggestedPoolAddress, poolWarnings: market.warnings,
        ...analyzeCandles(market.candles, timeframe)
      };
    } catch (error) {
      return { assetType: "DEX", exchange: "GECKOTERMINAL", instrumentId: token.tokenAddress.slice(0, 10), network: token.network, tokenAddress: token.tokenAddress, status: "ERROR", error: error.message };
    }
  });
}

async function scanMetals() {
  const minimumCandles = Number(config.metals?.minimumAlertCandles) || 100;
  return mapLimited(METAL_ALERT_PRODUCTS, 3, async productId => {
    const meta = METAL_PRODUCTS[productId];
    try {
      const market = await fetchMetalCandles(productId, "SELL", config.metals.chartCandles, {
        ...metalsApi,
        completeOnly: true
      });
      return {
        assetType: "METALS",
        exchange: "METALS_DATA_COLLECTOR",
        instrumentId: productId,
        productId,
        productName: meta.name,
        side: "SELL",
        timeframe: "1D",
        currency: meta.currency,
        unit: meta.unit,
        ...analyzeCandles(market.candles, "1D", minimumCandles)
      };
    } catch (error) {
      return {
        assetType: "METALS",
        exchange: "METALS_DATA_COLLECTOR",
        instrumentId: productId,
        productId,
        productName: meta.name,
        side: "SELL",
        timeframe: "1D",
        status: "ERROR",
        error: error.message
      };
    }
  });
}

function effectiveAutomation(settings) {
  return {
    ...settings,
    timezone: config.automation.timezone,
    telegram: { ...settings.telegram, chatId: settings.telegram.chatId || String(process.env.TELEGRAM_CHAT_ID || "").trim() }
  };
}

async function runAutomation(timeframe, trigger = "manual", options = {}) {
  const settings = effectiveAutomation(await loadAutomation(automationPath));
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Chưa cấu hình TELEGRAM_BOT_TOKEN trong .env");
  if (!settings.telegram.chatId) throw new Error("Chưa cấu hình Telegram Chat ID");

  const rows = [];
  if (settings.assets.cex.enabled && settings.assets.cex.watchlist.length) rows.push(...await scan(normalizeInstruments(settings.assets.cex.watchlist), timeframe));
  if (settings.assets.dex.enabled && settings.assets.dex.watchlist.length) rows.push(...await scanDex(parseDexTokens(settings.assets.dex.watchlist), timeframe));
  if (!rows.length) throw new Error("Watchlist tự động đang trống");

  const state = await loadAutomationState(automationStatePath);
  const delivery = selectDeliverySignals(rows, options.sentKeys ?? state.sentKeys, timeframe, trigger);
  logScanErrors(`crypto:${timeframe}`, rows);

  const allFailed = rows.length > 0 && rows.every(row => row.status === "ERROR");
  const shouldSend = delivery.delivered.length > 0 || settings.telegram.sendNoSignalSummary || allFailed;
  const telegramText = shouldSend ? formatAutomationReport(timeframe, rows, delivery, settings, trigger) : "";
  if (telegramText && options.deferTelegram !== true) await sendTelegramText(token, settings.telegram.chatId, telegramText);

  if (options.deferTelegram !== true) state.sentKeys = delivery.sentKeys;
  state.lastRuns = { ...(state.lastRuns || {}), [`crypto:${timeframe}`]: { at: Date.now(), assetGroup: "crypto", timeframe, trigger, total: rows.length, detectedSignals: delivery.detected.length, sentSignals: delivery.delivered.length, suppressedSignals: delivery.suppressed, errors: rows.filter(row => row.status === "ERROR").length, status: "OK" } };
  await saveAutomationState(automationStatePath, state);
  return { timeframe, total: rows.length, detectedSignals: delivery.detected.length, sentSignals: delivery.delivered.length, suppressedSignals: delivery.suppressed, errors: rows.filter(row => row.status === "ERROR").length, messageSent: shouldSend && options.deferTelegram !== true, telegramText, sentKeys: delivery.sentKeys };
}

async function runDexAutomation(timeframe, trigger = "manual", options = {}) {
  if (!["4H", "8H"].includes(timeframe)) throw new Error("Cảnh báo DEX chỉ hỗ trợ 4H hoặc 8H");
  const settings = effectiveAutomation(await loadAutomation(automationPath));
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Chưa cấu hình TELEGRAM_BOT_TOKEN trong .env");
  if (!settings.telegram.chatId) throw new Error("Chưa cấu hình Telegram Chat ID");
  if (!settings.assets.dex.enabled) throw new Error("Watchlist DEX tự động đang tắt");

  const tokens = assertPinnedDexAlertTokens(parseDexTokens(settings.assets.dex.watchlist));
  const rows = await scanDex(tokens, timeframe);
  const state = await loadAutomationState(automationStatePath);
  const delivery = selectDeliverySignals(rows, options.sentKeys ?? state.sentKeys, timeframe, trigger);
  logScanErrors(`dex:${timeframe}`, rows);

  const errors = rows.filter(row => row.status === "ERROR");
  const allFailed = rows.length > 0 && errors.length === rows.length;
  const shouldSend = delivery.delivered.length > 0 || settings.telegram.sendNoSignalSummary || allFailed;
  const telegramText = shouldSend ? formatAutomationReport(timeframe, rows, delivery, settings, trigger, "DEX") : "";
  if (telegramText && options.deferTelegram !== true) await sendTelegramText(token, settings.telegram.chatId, telegramText);

  if (options.deferTelegram !== true) state.sentKeys = delivery.sentKeys;
  state.lastRuns = {
    ...(state.lastRuns || {}),
    [`dex:${timeframe}`]: {
      at: Date.now(), assetGroup: "dex", timeframe, trigger, total: rows.length,
      detectedSignals: delivery.detected.length, sentSignals: delivery.delivered.length,
      suppressedSignals: delivery.suppressed, errors: errors.length, status: "OK"
    }
  };
  await saveAutomationState(automationStatePath, state);
  return {
    timeframe, total: rows.length, detectedSignals: delivery.detected.length,
    sentSignals: delivery.delivered.length, suppressedSignals: delivery.suppressed,
    errors: errors.length, messageSent: shouldSend && options.deferTelegram !== true, telegramText, sentKeys: delivery.sentKeys
  };
}

async function runMetalsAutomation(trigger = "manual", options = {}) {
  const settings = effectiveAutomation(await loadAutomation(automationPath));
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Chưa cấu hình TELEGRAM_BOT_TOKEN trong .env");
  if (!settings.telegram.chatId) throw new Error("Chưa cấu hình Telegram Chat ID");
  if (!settings.assets.metals.enabled) throw new Error("Cảnh báo Vàng–Bạc đang tắt");

  const rows = await scanMetals();
  const state = await loadAutomationState(automationStatePath);
  const delivery = selectDeliverySignals(rows, options.sentKeys ?? state.sentKeys, "1D", trigger);
  logScanErrors("metals:1D", rows);
  const errors = rows.filter(row => row.status === "ERROR");
  const allFailed = rows.length > 0 && errors.length === rows.length;
  const shouldSend = delivery.delivered.length > 0 || settings.telegram.sendNoSignalSummary || allFailed;
  const telegramText = shouldSend ? formatAutomationReport("1D", rows, delivery, settings, trigger, "VÀNG & BẠC SELL") : "";
  if (telegramText && options.deferTelegram !== true) await sendTelegramText(token, settings.telegram.chatId, telegramText);

  if (options.deferTelegram !== true) state.sentKeys = delivery.sentKeys;
  state.lastRuns = {
    ...(state.lastRuns || {}),
    "metals:1D": {
      at: Date.now(), assetGroup: "metals", timeframe: "1D", side: "SELL", trigger,
      total: rows.length, detectedSignals: delivery.detected.length,
      sentSignals: delivery.delivered.length, suppressedSignals: delivery.suppressed,
      errors: errors.length, status: "OK"
    }
  };
  await saveAutomationState(automationStatePath, state);
  return {
    timeframe: "1D", side: "SELL", total: rows.length,
    detectedSignals: delivery.detected.length, sentSignals: delivery.delivered.length,
    suppressedSignals: delivery.suppressed, errors: errors.length,
    messageSent: shouldSend && options.deferTelegram !== true,
    telegramText, sentKeys: delivery.sentKeys
  };
}

function focusDirectionMatched(row) {
  return row.expectedDirection === "BUY" ? Boolean(row.buySignalTypes?.length) : Boolean(row.sellSignalTypes?.length);
}

async function runFocusAutomation(trigger = "manual", options = {}) {
  const settings = effectiveAutomation(await loadAutomation(automationPath));
  const now = Date.now();
  const focus = await loadFocusList(focusPath, now, config.focus);
  const active = focus.items.filter(item => item.expiresAt > now);
  if (!active.length) return { total: 0, matchedSignals: 0, sentSignals: 0, errors: 0, messageSent: false };
  const rows = await scanFocusItems(active);
  const matched = rows.filter(focusDirectionMatched).map(row => ({ ...row, status: row.expectedDirection }));
  const state = await loadAutomationState(automationStatePath);
  const delivery = selectDeliverySignals(matched, options.sentKeys ?? state.sentKeys, "FOCUS", trigger);
  const errors = rows.filter(row => row.status === "ERROR");
  logScanErrors("focus", rows);
  const shouldSend = delivery.delivered.length > 0 || (rows.length > 0 && errors.length === rows.length);
  let telegramText = "";
  if (shouldSend) {
    const lines = ["🎯 Trading Signal · Điểm vào khung nhỏ", `Thời điểm: ${new Date().toLocaleString("vi-VN", { timeZone: settings.timezone })}`, ""];
    for (const row of delivery.delivered) {
      const types = row.expectedDirection === "BUY" ? row.buySignalTypes : row.sellSignalTypes;
      lines.push(`${row.expectedDirection === "BUY" ? "🟢" : "🔴"} ${row.symbol} · ${row.exchange}`, `Điểm vào: ${row.expectedDirection} (${types.join(", ")}) · ${row.timeframe}`, `Giá đóng: ${row.close} · Nến: ${new Date(row.candleOpenTime).toLocaleString("vi-VN", { timeZone: "UTC" })}`, "");
    }
    lines.push(`Đã quét: ${rows.length} · Tín hiệu gửi: ${delivery.delivered.length} · Lỗi: ${errors.length}`);
    if (errors.length) lines.push(`Loại lỗi: ${formatScanErrorSummary(rows)}`);
    telegramText = lines.join("\n");
    if (options.deferTelegram !== true) await sendTelegramText(process.env.TELEGRAM_BOT_TOKEN, settings.telegram.chatId, telegramText);
  }
  if (options.deferTelegram !== true) state.sentKeys = delivery.sentKeys;
  state.lastRuns = { ...(state.lastRuns || {}), focus: { at: now, assetGroup: "focus", trigger, total: rows.length, detectedSignals: matched.length, sentSignals: delivery.delivered.length, errors: errors.length, status: "OK" } };
  await saveAutomationState(automationStatePath, state);
  return { total: rows.length, matchedSignals: matched.length, sentSignals: delivery.delivered.length, errors: errors.length, messageSent: shouldSend && options.deferTelegram !== true, telegramText, sentKeys: delivery.sentKeys, results: trigger === "manual" ? rows : undefined };
}

async function runNewCoinAutomation(trigger = "manual", options = {}) {
  const settings = effectiveAutomation(await loadAutomation(automationPath));
  const list = await loadNewCoinList(newCoinPath);
  const active = activeNewCoinItems(list.items);
  const paused = list.items.length - active.length;
  if (!active.length) return { timeframe: config.newCoins.timeframe, total: 0, paused, detectedSignals: 0, sentSignals: 0, suppressedSignals: 0, errors: 0, messageSent: false };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Chưa cấu hình TELEGRAM_BOT_TOKEN trong .env");
  if (!settings.telegram.chatId) throw new Error("Chưa cấu hình Telegram Chat ID");

  const rows = await scanNewCoinItems(active);
  const state = await loadAutomationState(automationStatePath);
  const delivery = selectDeliverySignals(rows, options.sentKeys ?? state.sentKeys, `NEW_COIN:${config.newCoins.timeframe}`, trigger);
  delivery.paused = paused;
  const errors = rows.filter(row => row.status === "ERROR");
  logScanErrors("new-coins:8H", rows);

  const allFailed = rows.length > 0 && errors.length === rows.length;
  const shouldSend = delivery.delivered.length > 0 || settings.telegram.sendNoSignalSummary || allFailed;
  const telegramText = shouldSend ? formatNewCoinReport(rows, delivery, settings, trigger, config.newCoins.timeframe) : "";
  if (telegramText && options.deferTelegram !== true) await sendTelegramText(token, settings.telegram.chatId, telegramText);

  if (options.deferTelegram !== true) state.sentKeys = delivery.sentKeys;
  state.lastRuns = {
    ...(state.lastRuns || {}),
    newCoins: {
      at: Date.now(), assetGroup: "new-coins", timeframe: config.newCoins.timeframe, trigger,
      total: rows.length, paused, detectedSignals: delivery.detected.length,
      sentSignals: delivery.delivered.length, suppressedSignals: delivery.suppressed,
      errors: errors.length, status: "OK"
    }
  };
  await saveAutomationState(automationStatePath, state);
  return {
    timeframe: config.newCoins.timeframe, total: rows.length, paused,
    detectedSignals: delivery.detected.length, sentSignals: delivery.delivered.length,
    suppressedSignals: delivery.suppressed, errors: errors.length, messageSent: shouldSend && options.deferTelegram !== true, telegramText, sentKeys: delivery.sentKeys,
    results: trigger === "manual" ? rows : undefined
  };
}

let schedulerBusy = false;

function scheduledJobLabel(job) {
  if (job.assetGroup === "stocks") return "Stock D1";
  if (job.assetGroup === "metals") return "Vàng/Bạc D1";
  if (job.assetGroup === "dex") return `DEX ${job.timeframe}`;
  if (job.timeframe === "FOCUS") return "Focus";
  if (job.timeframe === "NEW_COIN") return `Coin mới ${config.newCoins.timeframe}`;
  return `Crypto ${job.timeframe}`;
}

async function schedulerTick() {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    const settings = effectiveAutomation(await loadAutomation(automationPath));
    const clock = localClock(new Date(), settings.timezone);
    const jobs = dueAutomationJobs(clock, settings, config);
    if (!jobs.length) return;

    const slot = `${clock.date}|${clock.time}`;
    const initial = await loadAutomationState(automationStatePath);
    const pendingJobs = jobs.filter(job => initial.lastSlots?.[job.key] !== slot);
    if (!pendingJobs.length) return;

    // A persisted batch marker gives the scheduler at-most-once behavior across
    // process restarts. If a process died while a Telegram send was in-flight,
    // we deliberately do not retry that slot because avoiding duplicates is the
    // safer policy for alert delivery.
    if (["sending", "sent", "failed-send"].includes(initial.batchSlots?.[slot]?.status)) return;

    const reports = [];
    const failures = [];
    let sharedSentKeys = [...(initial.sentKeys || [])];
    const completedKeys = [];

    for (const job of pendingJobs) {
      try {
        let result;
        const options = { deferTelegram: true, sentKeys: sharedSentKeys };
        if (job.assetGroup === "dex") result = await runDexAutomation(job.timeframe, "schedule", options);
        else if (job.assetGroup === "metals") result = await runMetalsAutomation("schedule", options);
        else if (job.assetGroup === "stocks") result = await runStocksAutomation("schedule", options);
        else if (job.timeframe === "FOCUS") result = await runFocusAutomation("schedule", options);
        else if (job.timeframe === "NEW_COIN") result = await runNewCoinAutomation("schedule", options);
        else result = await runAutomation(job.timeframe, "schedule", options);

        if (result.telegramText) reports.push(result.telegramText);
        if (Array.isArray(result.sentKeys)) sharedSentKeys = result.sentKeys;
        completedKeys.push(job.key);
      } catch (error) {
        const latest = await loadAutomationState(automationStatePath);
        const runKey = job.assetGroup === "dex" ? `dex:${job.timeframe}` : job.assetGroup === "metals" ? "metals:1D" : job.assetGroup === "stocks" ? "stocks:1D" : job.timeframe === "FOCUS" ? "focus" : job.timeframe === "NEW_COIN" ? "newCoins" : `crypto:${job.timeframe}`;
        const assetGroup = job.assetGroup === "dex" ? "dex" : job.assetGroup === "metals" ? "metals" : job.assetGroup === "stocks" ? "stocks" : job.timeframe === "FOCUS" ? "focus" : job.timeframe === "NEW_COIN" ? "new-coins" : "crypto";
        latest.lastRuns = { ...(latest.lastRuns || {}), [runKey]: { at: Date.now(), assetGroup, timeframe: job.timeframe === "NEW_COIN" ? config.newCoins.timeframe : job.timeframe, trigger: "schedule", status: "ERROR", errors: 1 } };
        await saveAutomationState(automationStatePath, latest);
        failures.push({ key: job.key, label: scheduledJobLabel(job), errors: 1 });
        completedKeys.push(job.key);
        console.error(`Automation ${job.timeframe}: ${error.message}`);
      }
    }

    const hasBatch = reports.length > 0 || failures.length > 0;
    const beforeSend = await loadAutomationState(automationStatePath);
    beforeSend.lastSlots = { ...(beforeSend.lastSlots || {}) };
    for (const key of completedKeys) beforeSend.lastSlots[key] = slot;

    if (!hasBatch) {
      // Jobs such as Stock on a market holiday can intentionally produce no
      // report. Mark the slot complete so scheduler polling/restarts cannot
      // execute the same closed candle again.
      await saveAutomationState(automationStatePath, beforeSend);
      return;
    }

    beforeSend.batchSlots = {
      ...(beforeSend.batchSlots || {}),
      [slot]: { status: "sending", at: Date.now(), jobs: completedKeys, reports: reports.length, failures: failures.length }
    };
    await saveAutomationState(automationStatePath, beforeSend);

    try {
      await sendTelegramText(process.env.TELEGRAM_BOT_TOKEN, settings.telegram.chatId, formatScheduledBatchReport(reports, settings, new Date(), failures));
      const latest = await loadAutomationState(automationStatePath);
      latest.sentKeys = [...new Set(sharedSentKeys)];
      latest.lastSlots = { ...(latest.lastSlots || {}) };
      for (const key of completedKeys) latest.lastSlots[key] = slot;
      latest.batchSlots = { ...(latest.batchSlots || {}), [slot]: { status: "sent", at: Date.now(), jobs: completedKeys, reports: reports.length, failures: failures.length } };
      await saveAutomationState(automationStatePath, latest);
    } catch (error) {
      // Keep the slot consumed. We do not retry a possibly-delivered Telegram
      // batch after a restart, which enforces the project's no-duplicate policy.
      const latest = await loadAutomationState(automationStatePath);
      latest.lastSlots = { ...(latest.lastSlots || {}) };
      for (const key of completedKeys) latest.lastSlots[key] = slot;
      latest.batchSlots = { ...(latest.batchSlots || {}), [slot]: { status: "failed-send", at: Date.now(), jobs: completedKeys, reports: reports.length, failures: failures.length } };
      await saveAutomationState(automationStatePath, latest);
      console.error(`Automation batch ${slot}: ${error.message}`);
    }
  } finally { schedulerBusy = false; }
}

const server = http.createServer(async (req, res) => {
  try {
    setSecurityHeaders(req, res);
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/") || ["/", "/index.html", "/login.html"].includes(url.pathname)) res.setHeader("cache-control", "no-store");
    if (url.pathname === "/api/health") return json(res, 200, { status: "ok", app: "Trading Signal", version: packageInfo.version, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) });
    if (url.pathname === "/api/auth/status" && req.method === "GET") return json(res, 200, { authRequired: auth.enabled, authenticated: hasSession(req) });
    if (url.pathname === "/api/auth/login" && req.method === "POST") {
      if (!auth.enabled) return json(res, 200, { authenticated: true });
      if (!isSameOrigin(req)) return json(res, 403, { error: "Yêu cầu đăng nhập không cùng nguồn" });
      const key = clientKey(req);
      const limit = loginLimiter.status(key);
      if (!limit.allowed) {
        res.setHeader("retry-after", String(limit.retryAfterSeconds));
        return json(res, 429, { error: `Đăng nhập bị khóa tạm thời. Thử lại sau ${limit.retryAfterSeconds} giây` });
      }
      const request = await readJsonBody(req);
      const passwordMatches = await verifyPassword(request.password, auth.passwordHash);
      if (String(request.username ?? "") !== auth.username || !passwordMatches) {
        loginLimiter.fail(key);
        return json(res, 401, { error: "Tên đăng nhập hoặc mật khẩu không đúng" });
      }
      loginLimiter.success(key);
      const token = createSessionToken(auth.username, auth.sessionSecret, auth.maxAgeSeconds);
      res.setHeader("set-cookie", sessionCookie(token, auth.maxAgeSeconds, production || isHttps(req)));
      res.setHeader("cache-control", "no-store");
      return json(res, 200, { authenticated: true, username: auth.username });
    }
    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      if (auth.enabled && !isSameOrigin(req)) return json(res, 403, { error: "Yêu cầu đăng xuất không cùng nguồn" });
      res.setHeader("set-cookie", clearSessionCookie(production || isHttps(req)));
      res.setHeader("cache-control", "no-store");
      res.setHeader("clear-site-data", '"cache", "storage"');
      return json(res, 200, { authenticated: false });
    }

    const publicFile = ["/login.html", "/login.js", "/app.css"].includes(url.pathname);
    const authenticated = hasSession(req);
    if (url.pathname === "/login.html" && authenticated) return redirect(res, "/");
    if (!authenticated && !publicFile) {
      if (url.pathname.startsWith("/api/")) return json(res, 401, { error: "Cần đăng nhập", code: "AUTH_REQUIRED" });
      return redirect(res, "/login.html");
    }
    if (authenticated && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !isSameOrigin(req)) return json(res, 403, { error: "Yêu cầu thay đổi không cùng nguồn" });

    if (url.pathname === "/api/config") return json(res, 200, { ...config, app: { name: "Trading Signal", version: packageInfo.version }, capabilities: { dexWeekly: Boolean(process.env.COINGECKO_API_KEY), telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN), metals: true, metalsAutomation: true, stocks: true } });
    if (url.pathname === "/api/dex/pools" && req.method === "GET") {
      const [token] = parseDexTokens([{
        network: url.searchParams.get("network"),
        tokenAddress: url.searchParams.get("tokenAddress")
      }]);
      const pools = await discoverDexPoolOptions(token, { ...config.dex, apiKey: process.env.COINGECKO_API_KEY });
      return json(res, 200, { ...token, minimumLiquidityUsd: config.dex.minimumLiquidityUsd, pools });
    }
    if (url.pathname === "/api/automation" && req.method === "GET") {
      const settings = effectiveAutomation(await loadAutomation(automationPath));
      const state = await loadAutomationState(automationStatePath);
      return json(res, 200, { settings, state: { lastRuns: state.lastRuns || {} }, capabilities: { telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN), dexWeekly: Boolean(process.env.COINGECKO_API_KEY) } });
    }
    if (url.pathname === "/api/automation" && req.method === "PUT") {
      const request = await readJsonBody(req);
      const normalized = normalizeAutomation(request);
      normalizeInstruments(normalized.assets.cex.watchlist);
      parseDexTokens(normalized.assets.dex.watchlist);
      const candidate = effectiveAutomation(normalized);
      if (candidate.enabled && !process.env.TELEGRAM_BOT_TOKEN) return json(res, 400, { error: "Cần TELEGRAM_BOT_TOKEN trong .env trước khi bật tự động" });
      if (candidate.enabled && !candidate.telegram.chatId) return json(res, 400, { error: "Cần Telegram Chat ID trước khi bật tự động" });
      const hasCex = candidate.assets.cex.enabled && candidate.assets.cex.watchlist.length;
      const hasDex = candidate.assets.dex.enabled && candidate.assets.dex.watchlist.length;
      const hasMetals = candidate.assets.metals.enabled && candidate.schedules.metalsDaily.enabled;
      const hasStocks = candidate.assets.stocks.enabled && candidate.schedules.stockDaily.enabled;
      const hasDexAlertSchedule = candidate.schedules.dex4h.enabled || candidate.schedules.dex8h.enabled;
      if (candidate.enabled && hasDexAlertSchedule && !candidate.assets.dex.enabled) return json(res, 400, { error: "Cần bật watchlist DEX trước khi bật lịch DEX 4H/8H" });
      if (candidate.enabled && hasDexAlertSchedule) {
        try { assertPinnedDexAlertTokens(candidate.assets.dex.watchlist); }
        catch (error) { return json(res, 400, { error: error.message }); }
      }
      const newCoins = await loadNewCoinList(newCoinPath);
      const hasNewCoins = candidate.schedules.newCoinScan.enabled && activeNewCoinItems(newCoins.items).length;
      if (candidate.enabled && candidate.schedules.metalsDaily.enabled && !candidate.assets.metals.enabled) return json(res, 400, { error: "Cần bật tài sản Vàng–Bạc trước khi bật lịch SELL D1" });
      if (candidate.enabled && candidate.schedules.stockDaily.enabled && !candidate.assets.stocks.enabled) return json(res, 400, { error: "Cần bật Stock trước khi bật lịch Stock D1" });
      if (candidate.enabled && candidate.assets.stocks.enabled && !(candidate.assets.stocks.scopes || []).length) return json(res, 400, { error: "Cần chọn ít nhất một phạm vi Stock automation" });
      if (candidate.enabled && !hasCex && !hasDex && !hasNewCoins && !hasMetals && !hasStocks) return json(res, 400, { error: "Cần bật ít nhất một nhóm CEX, DEX, Coin mới, Vàng–Bạc hoặc Stock" });
      const settings = effectiveAutomation(await saveAutomation(automationPath, normalized));
      return json(res, 200, { settings, saved: true });
    }
    if (url.pathname === "/api/automation/chats" && req.method === "POST") {
      if (!process.env.TELEGRAM_BOT_TOKEN) return json(res, 400, { error: "Chưa cấu hình TELEGRAM_BOT_TOKEN trong .env" });
      return json(res, 200, { chats: await findTelegramChats(process.env.TELEGRAM_BOT_TOKEN) });
    }
    if (url.pathname === "/api/automation/test" && req.method === "POST") {
      const settings = effectiveAutomation(await loadAutomation(automationPath));
      await sendTelegramText(process.env.TELEGRAM_BOT_TOKEN, settings.telegram.chatId, `✅ Trading Signal đã kết nối thành công.\n${new Date().toLocaleString("vi-VN", { timeZone: settings.timezone })}`);
      return json(res, 200, { sent: true });
    }
    if (url.pathname === "/api/automation/run" && req.method === "POST") {
      const request = await readJsonBody(req);
      const timeframe = request.timeframe === "1W" ? "1W" : "1D";
      return json(res, 200, await runAutomation(timeframe));
    }
    if (url.pathname === "/api/automation/dex/run" && req.method === "POST") {
      const request = await readJsonBody(req);
      const timeframe = request.timeframe === "8H" ? "8H" : "4H";
      return json(res, 200, await runDexAutomation(timeframe));
    }
    if (url.pathname === "/api/automation/metals/run" && req.method === "POST") {
      return json(res, 200, await runMetalsAutomation("manual"));
    }
    if (url.pathname === "/api/automation/stocks/run" && req.method === "POST") {
      return json(res, 200, await runStocksAutomation("manual"));
    }
    if (url.pathname === "/api/focus" && req.method === "GET") {
      const data = await loadFocusList(focusPath, Date.now(), config.focus);
      return json(res, 200, { items: data.items, now: Date.now() });
    }
    if (url.pathname === "/api/focus" && req.method === "POST") {
      const request = await readJsonBody(req);
      const entry = await upsertFocusEntry(focusPath, request, Date.now(), config.focus);
      return json(res, 200, { entry, saved: true });
    }
    if (url.pathname === "/api/focus/run" && req.method === "POST") return json(res, 200, await runFocusAutomation("manual"));
    if (url.pathname === "/api/new-coins" && req.method === "GET") {
      const data = await loadNewCoinList(newCoinPath);
      return json(res, 200, { items: data.items, now: Date.now() });
    }
    if (url.pathname === "/api/new-coins/run" && req.method === "POST") return json(res, 200, await runNewCoinAutomation("manual"));
    if (url.pathname === "/api/new-coins" && req.method === "POST") {
      const request = await readJsonBody(req);
      const instrumentId = String(request.instrumentId || request.symbol || "").trim().toUpperCase();
      if (!instrumentId) return json(res, 400, { error: "Hãy nhập mã coin hoặc cặp Spot" });
      let active;
      try { active = await resolveActiveSpotMarket(instrumentId, config.newCoins.exchangePriority, config.quotePriority); }
      catch (error) {
        if (error instanceof MarketNotFoundError) return json(res, 400, { error: error.message });
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), job: "new-coins:add", asset: instrumentId, error: error.message }));
        return json(res, 503, { error: "Không thể kiểm tra sàn lúc này; chi tiết đã được ghi vào log" });
      }
      try {
        const entry = await addNewCoinEntry(newCoinPath, active);
        return json(res, 201, { entry, saved: true });
      } catch (error) {
        if (error.code === "NEW_COIN_EXISTS") return json(res, 409, { error: error.message });
        throw error;
      }
    }
    if (url.pathname === "/api/metals/latest" && req.method === "GET") {
      try {
        const payload = await fetchMetalsLatest(metalsApi);
        let comparison;
        try { comparison = buildMetalComparison(payload); }
        catch (error) { comparison = { error: error.message, rows: [] }; }
        return json(res, 200, { ...payload, catalog: METAL_PRODUCTS, comparison });
      } catch (error) {
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), job: "metals:latest", error: error.message }));
        return json(res, 503, { error: "Không thể đọc Metals Data Collector; chi tiết đã được ghi vào log" });
      }
    }
    if (url.pathname === "/api/stocks/symbols" && req.method === "GET") {
      try {
        return json(res, 200, { symbols: await fetchStockSymbols(stocksApi) });
      } catch (error) {
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), job: "stocks:symbols", error: error.message }));
        return json(res, 503, { error: "Không thể đọc Stocks Data Collector" });
      }
    }
    if (url.pathname === "/api/stocks/instruments" && req.method === "POST") {
      try {
        const request = await readJsonBody(req);
        const symbols = parseStockSymbolList(request.symbols ?? request.symbol);
        if (!symbols.length) return json(res, 400, { error: "Danh sách mã chứng khoán đang trống" });
        if (symbols.length > 100) return json(res, 400, { error: "Mỗi lần chỉ thêm tối đa 100 mã" });
        const years = Math.min(Math.max(Number(request.years) || 3, 1), 10);
        const current = await fetchStockSymbols(stocksApi);
        const active = new Set(current.map(item => item.symbol));
        const added = [];
        const prepared = [];
        const retried = [];
        const failed = [];
        // Always ask the collector to prepare every requested symbol.
        // stocks-data-collector v0.2.1 Smart Backfill is authoritative:
        // - complete coverage => backfill.skipped=true and no provider data request
        // - incomplete/empty coverage => fetch only the missing range
        // This also repairs legacy active instruments whose first backfill timed out.
        for (const symbol of symbols) {
          try {
            const wasActive = active.has(symbol);
            const result = await addStockInstrument(symbol, years, { ...stocksApi, timeoutMs: Number(config.stocks.adminTimeoutMs) || 300_000 });
            const row = { symbol, instrument: result.instrument, backfill: result.backfill };
            const classification = classifyStockPrepareResult(result, wasActive);
            if (classification === "prepared") prepared.push(row);
            else if (classification === "retried") retried.push(row);
            else added.push(row);
          } catch (error) {
            console.error(JSON.stringify({ timestamp: new Date().toISOString(), job: "stocks:add:item", symbol, error: error.message }));
            failed.push({ symbol, error: error.message });
          }
        }
        // `skipped` remains as a backward-compatible alias for clients from v3.3.0.
        return json(res, failed.length ? 207 : 201, { requested: symbols.length, added, prepared, retried, skipped: prepared, failed });
      } catch (error) {
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), job: "stocks:add", error: error.message }));
        return json(res, 400, { error: error.message });
      }
    }
    if (url.pathname === "/api/stocks/instruments" && req.method === "DELETE") {
      try {
        const symbol = normalizeStockSymbol(url.searchParams.get("symbol"));
        const result = await removeStockInstrument(symbol, stocksApi);
        const settings = await loadAutomation(automationPath);
        const current = settings.assets?.stocks?.watchlist || [];
        const watchlist = current.filter(item => String(item).toUpperCase() !== symbol);
        await saveAutomation(automationPath, {
          ...settings,
          assets: { ...settings.assets, stocks: { ...settings.assets.stocks, watchlist } }
        });
        return json(res, 200, { ...result, watchlistRemoved: current.length !== watchlist.length });
      } catch (error) {
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), job: "stocks:remove", error: error.message }));
        return json(res, 400, { error: error.message });
      }
    }
    if (url.pathname === "/api/stocks/groups" && req.method === "GET") {
      try {
        const groups = await fetchStockUniverseGroups(stocksApi);
        return json(res, 200, { groups });
      } catch (error) {
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), job: "stocks:groups", error: error.message }));
        return json(res, 503, { error: "Không thể tải nhóm quét chứng khoán" });
      }
    }
    if (url.pathname === "/api/stocks/watchlist" && req.method === "GET") {
      const settings = effectiveAutomation(await loadAutomation(automationPath));
      return json(res, 200, { symbols: settings.assets.stocks.watchlist });
    }
    if (url.pathname === "/api/stocks/watchlist" && req.method === "PUT") {
      const request = await readJsonBody(req);
      const requested = [...new Set((Array.isArray(request.symbols) ? request.symbols : []).map(normalizeStockSymbol))].slice(0, 1000);
      const catalog = await fetchStockSymbols(stocksApi);
      const allowed = new Set(catalog.map(item => item.symbol));
      const unknown = requested.filter(symbol => !allowed.has(symbol));
      if (unknown.length) return json(res, 400, { error: `Mã chưa có trong Stocks Data Collector: ${unknown.join(", ")}` });
      const settings = await loadAutomation(automationPath);
      const saved = await saveAutomation(automationPath, {
        ...settings, assets: { ...settings.assets, stocks: { ...settings.assets.stocks, watchlist: requested, provider: "SSI" } }
      });
      return json(res, 200, { symbols: saved.assets.stocks.watchlist, saved: true });
    }
    if (url.pathname === "/api/scan/stocks" && req.method === "POST") {
      const request = await readJsonBody(req);
      const settings = effectiveAutomation(await loadAutomation(automationPath));
      const scope = String(request.scope || "WATCHLIST").trim().toUpperCase();
      let symbols;
      let scopeInfo = { scope: "WATCHLIST", total: settings.assets.stocks.watchlist.length, preparedCount: settings.assets.stocks.watchlist.length, missingCount: 0 };
      if (scope === "WATCHLIST") {
        symbols = [...new Set((Array.isArray(request.symbols) && request.symbols.length ? request.symbols : settings.assets.stocks.watchlist).map(normalizeStockSymbol))];
      } else {
        const groups = await fetchStockUniverseGroups(stocksApi);
        const group = groups.find(item => item.group === scope);
        if (!group) return json(res, 400, { error: `Nhóm quét Stock không hợp lệ: ${scope}` });
        symbols = group.prepared.map(item => item.symbol);
        scopeInfo = { scope, total: group.total, preparedCount: group.preparedCount, missingCount: group.missingCount, provider: group.provider };
      }
      if (!symbols.length) return json(res, 400, { error: scope === "WATCHLIST" ? "Watchlist chứng khoán đang trống" : `Nhóm ${scope} chưa có mã nào được chuẩn bị dữ liệu` });
      const results = await scanStocks(symbols);
      logScanErrors(`stocks:1D:manual:${scope}`, results);
      return json(res, 200, { generatedAt: Date.now(), timeframe: "1D", closedBarsOnly: true, scope: scopeInfo, results });
    }
    if (url.pathname === "/api/stocks/overview" && req.method === "GET") {
      try {
        const symbols = await fetchStockSymbols(stocksApi);
        const rows = await Promise.all(symbols.map(async meta => {
          try {
            const market = await fetchStockCandles(meta.symbol, 20, stocksApi);
            return { ...meta, ...summarizeStockCandles(market.candles), provider: market.provider };
          } catch (error) {
            console.error(JSON.stringify({ timestamp: new Date().toISOString(), job: "stocks:overview:item", symbol: meta.symbol, error: error.message }));
            return { ...meta, close: null, previousClose: null, changePercent: null, openTime: null, volume: null, provider: "database", dataError: true };
          }
        }));
        return json(res, 200, { rows, count: rows.length });
      } catch (error) {
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), job: "stocks:overview", error: error.message }));
        return json(res, 503, { error: "Không thể tải tổng quan Chứng khoán Việt Nam" });
      }
    }
    if (url.pathname === "/api/chart/stocks" && req.method === "GET") {
      const symbol = normalizeStockSymbol(url.searchParams.get("symbol"));
      const timeframe = ["1D", "1W"].includes(url.searchParams.get("timeframe")) ? url.searchParams.get("timeframe") : "1D";
      const requestedLimit = Number(url.searchParams.get("limit") || config.stocks.chartCandles);
      const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 100), 1000) : config.stocks.chartCandles;
      try {
        const market = await fetchStockCandles(symbol, limit, stocksApi);
        if (market.candles.length < 100) return json(res, 503, { error: `Không đủ dữ liệu ${symbol}: chỉ có ${market.candles.length} nến D1` });
        const symbols = await fetchStockSymbols(stocksApi);
        const meta = symbols.find(item => item.symbol === symbol) || { symbol, exchange: "VN", name: symbol };
        const payload = chartPayload(market.candles, { asset: symbol, exchange: meta.exchange, instrumentId: symbol, quote: "VND" }, timeframe);
        payload.market = { ...payload.market, name: meta.name, currency: "VND", provider: market.provider, assetType: "STOCK" };
        return json(res, 200, payload);
      } catch (error) {
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), job: "stocks:chart", symbol, error: error.message }));
        return json(res, /không hợp lệ/.test(error.message) ? 400 : 503, { error: /không hợp lệ/.test(error.message) ? error.message : "Không thể tải nến từ Stocks Data Collector" });
      }
    }
    if (url.pathname === "/api/chart/metals" && req.method === "GET") {
      const timeframe = config.metals.timeframes.includes(url.searchParams.get("timeframe"))
        ? url.searchParams.get("timeframe") : config.metals.defaultTimeframe;
      const productCode = String(url.searchParams.get("product") || "VN_GOLD_SJC_BAR").toUpperCase();
      const side = String(url.searchParams.get("side") || "").toUpperCase();
      const requestedLimit = Number(url.searchParams.get("limit") || config.metals.chartCandles);
      const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 100), 1000) : config.metals.chartCandles;
      try {
        const market = await fetchMetalCandles(productCode, side, limit, metalsApi);
        const { meta } = market.selection;
        const payload = chartPayload(market.candles, {
          asset: market.selection.productCode, exchange: "METALS",
          instrumentId: market.selection.productCode, quote: meta.currency
        }, timeframe);
        payload.market = {
          ...payload.market, name: meta.name, market: meta.market,
          currency: meta.currency, unit: meta.unit, side: market.selection.side
        };
        return json(res, 200, payload);
      } catch (error) {
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), job: "metals:chart", productCode, side, error: error.message }));
        const invalid = /không hợp lệ/.test(error.message);
        return json(res, invalid ? 400 : 503, { error: invalid ? error.message : "Không thể tải nến từ Metals Data Collector" });
      }
    }
    if (url.pathname === "/api/chart/cex" && req.method === "GET") {
      const timeframe = ["1H", "4H", "8H", "1D", "1W"].includes(url.searchParams.get("timeframe")) ? url.searchParams.get("timeframe") : "1D";
      const exchange = String(url.searchParams.get("exchange") || "AUTO").toUpperCase();
      const symbol = String(url.searchParams.get("symbol") || "").trim().toUpperCase();
      const requestedLimit = Number(url.searchParams.get("limit") || config.candleLimit);
      const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 100), 1000) : config.candleLimit;
      if (!symbol || !/^[A-Z0-9_-]{2,40}$/.test(symbol)) return json(res, 400, { error: "Mã coin không hợp lệ" });
      const instrument = parseInstrument(exchange === "AUTO" ? symbol : `${exchange}:${symbol}`);
      const sourceTimeframe = sourceTimeframeFor(timeframe);
      const resolved = await resolveAndFetchClosedCandles(instrument, sourceTimeframe, limit, config.exchangePriority, config.quotePriority, true);
      return json(res, 200, chartPayload(resolved.candles, resolved.instrument, timeframe));
    }
    if (url.pathname === "/api/chart/dex" && req.method === "GET") {
      const timeframe = config.dex.timeframes.includes(url.searchParams.get("timeframe")) ? url.searchParams.get("timeframe") : config.dex.defaultTimeframe;
      const [token] = parseDexTokens([{
        network: url.searchParams.get("network"),
        tokenAddress: url.searchParams.get("tokenAddress"),
        poolAddress: url.searchParams.get("poolAddress")
      }]);
      const market = await fetchDexCandles(token, timeframe, { ...config.dex, apiKey: process.env.COINGECKO_API_KEY }, Number(config.dex.chartCandles) || 500, true);
      const payload = chartPayload(market.candles, { asset: market.tokenSymbol, exchange: "DEX", instrumentId: market.tokenSymbol, quote: market.quoteSymbol }, timeframe);
      payload.market = { ...payload.market, network: market.network, tokenAddress: market.tokenAddress, poolAddress: market.poolAddress, poolName: market.poolName, dex: market.dex, liquidityUsd: market.liquidityUsd, poolPinned: market.poolPinned, suggestedPoolAddress: market.suggestedPoolAddress, poolWarnings: market.warnings };
      return json(res, 200, payload);
    }
    if (url.pathname === "/api/market/quotes" && req.method === "POST") {
      const request = await readJsonBody(req);
      if (!Array.isArray(request.items) || !request.items.length) return json(res, 400, { error: "Danh sách coin trống" });
      if (request.items.length > 100) return json(res, 400, { error: "Danh sách chart tối đa 100 coin" });
      const items = request.items.map(item => {
        const exchange = String(item.exchange || "AUTO").toUpperCase();
        const symbol = String(item.symbol || item.instrumentId || "").trim().toUpperCase();
        if (!symbol || !/^[A-Z0-9_\/-]{1,40}$/.test(symbol)) throw new Error(`Mã coin không hợp lệ: ${symbol || "trống"}`);
        return { requested: { exchange, symbol }, instrument: parseInstrument(exchange === "AUTO" ? symbol : `${exchange}:${symbol}`) };
      });
      const quotes = await mapLimited(items, Math.min(config.requestConcurrency, 5), async item => {
        try {
          return { ...(await fetchMarketQuote(item.instrument, { exchangePriority: config.exchangePriority, quotePriority: config.quotePriority })), requested: item.requested };
        } catch (error) {
          return { ...item.requested, status: "ERROR", error: error.message };
        }
      });
      return json(res, 200, { generatedAt: Date.now(), quotes });
    }
    const focusMatch = url.pathname.match(/^\/api\/focus\/([A-Z0-9]+)(?:\/(extend))?$/i);
    if (focusMatch && req.method === "POST" && focusMatch[2] === "extend") return json(res, 200, { entry: await extendFocusEntry(focusPath, focusMatch[1], Date.now(), config.focus) });
    if (focusMatch && req.method === "DELETE" && !focusMatch[2]) return json(res, (await deleteFocusEntry(focusPath, focusMatch[1], config.focus)) ? 200 : 404, { deleted: true });
    const newCoinMatch = url.pathname.match(/^\/api\/new-coins\/([^/]+)(?:\/(pause))?$/);
    if (newCoinMatch) {
      const id = decodeURIComponent(newCoinMatch[1]);
      if (req.method === "PATCH" && newCoinMatch[2] === "pause") {
        const request = await readJsonBody(req);
        const entry = await setNewCoinPaused(newCoinPath, id, request.paused === true);
        return entry ? json(res, 200, { entry, saved: true }) : json(res, 404, { error: "Coin không còn trong danh sách" });
      }
      if (req.method === "DELETE" && !newCoinMatch[2]) {
        const deleted = await deleteNewCoinEntry(newCoinPath, id);
        return deleted ? json(res, 200, { deleted: true }) : json(res, 404, { error: "Coin không còn trong danh sách" });
      }
    }
    if (url.pathname === "/api/scan" && req.method === "POST") {
      const request = await readJsonBody(req);
      const timeframe = request.timeframe === "1W" ? "1W" : "1D";
      const instruments = normalizeInstruments(request.symbols ?? config.symbols);
      if (!instruments.length) return json(res, 400, { error: "Danh sách coin trống" });
      return json(res, 200, { generatedAt: Date.now(), timeframe, closedBarsOnly: true, results: await scan(instruments, timeframe) });
    }
    if (url.pathname === "/api/scan/dex" && req.method === "POST") {
      const request = await readJsonBody(req);
      const timeframe = config.dex.timeframes.includes(request.timeframe) ? request.timeframe : config.dex.defaultTimeframe;
      const tokens = parseDexTokens(request.tokens);
      if (!tokens.length) return json(res, 400, { error: "Danh sách token address trống" });
      if (tokens.length > config.dex.maxTokensPerScan) return json(res, 400, { error: `Mỗi lượt chỉ quét tối đa ${config.dex.maxTokensPerScan} token DEX` });
      return json(res, 200, { generatedAt: Date.now(), timeframe, closedBarsOnly: true, results: await scanDex(tokens, timeframe) });
    }
    const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (!/^[\w./-]+$/.test(requested) || requested.includes("..")) return json(res, 404, { error: "Not found" });
    const file = await readFile(join(root, "public", requested));
    res.writeHead(200, { "content-type": mime[extname(requested)] || "application/octet-stream" });
    res.end(file);
  } catch (error) {
    if (error.code === "ENOENT") return json(res, 404, { error: "Not found" });
    json(res, 500, { error: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`Trading Signal ${packageInfo.version}: http://${host}:${port}`);
  schedulerTick();
  setInterval(schedulerTick, config.automation.schedulerPollSeconds * 1000).unref();
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
