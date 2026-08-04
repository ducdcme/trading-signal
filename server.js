import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseInstruments } from "./lib/instruments.js";
import { fetchFromExchange, resolveAndFetchClosedCandles } from "./lib/market.js";
import { calculateSignals } from "./lib/indicator.js";
import { candlesForTimeframe } from "./lib/candles.js";
import { fetchDexDailyCandles } from "./lib/geckoterminal.js";
import { loadEnvFile } from "./lib/env.js";
import { loadAutomation, loadAutomationState, localClock, normalizeAutomation, saveAutomation, saveAutomationState } from "./lib/automation-store.js";
import { findTelegramChats, sendTelegramText } from "./lib/telegram.js";
import { selectDeliverySignals } from "./lib/automation-signals.js";
import { clearSessionCookie, createSessionToken, isSameOrigin, loadAuthConfig, LoginRateLimiter, parseCookies, sessionCookie, verifyPassword, verifySessionToken } from "./lib/auth.js";
import { deleteFocusEntry, extendFocusEntry, loadFocusList, upsertFocusEntry } from "./lib/focus-store.js";
import { parseInstrument } from "./lib/instruments.js";

const root = fileURLToPath(new URL(".", import.meta.url));
await loadEnvFile(join(root, ".env"));
const config = JSON.parse(await readFile(join(root, "config.json"), "utf8"));
const packageInfo = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const port = Number(process.env.PORT || 3210);
const host = process.env.HOST || "127.0.0.1";
const dataDir = resolve(root, process.env.DATA_DIR || "data");
const automationPath = join(dataDir, "automation.json");
const automationStatePath = join(dataDir, "automation-state.json");
const focusPath = join(dataDir, "focus-watchlist.json");
const startedAt = Date.now();
const production = process.env.NODE_ENV === "production";
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
  return parseInstruments(base);
}

function analyzeCandles(dailyCandles, timeframe) {
  const candles = candlesForTimeframe(dailyCandles, timeframe);
  if (candles.length < 100) throw new Error(`Không đủ dữ liệu: chỉ có ${candles.length} nến ${timeframe}`);
  const signals = calculateSignals(candles);
  const candle = candles.at(-1);
  const found = signals.at(-1);
  const status = found.buyTypes.length && found.sellTypes.length ? "BOTH" : found.buyTypes.length ? "BUY" : found.sellTypes.length ? "SELL" : "NONE";
  return { status, ...found, close: candle.close, candleOpenTime: candle.openTime, candleCloseTime: candle.closeTime, candleCount: candles.length };
}

async function scan(instruments, timeframe) {
  return mapLimited(instruments, config.requestConcurrency, async instrument => {
    try {
      const sourceTimeframe = timeframe === "1W" ? "1D" : timeframe;
      const resolved = await resolveAndFetchClosedCandles(instrument, sourceTimeframe, config.candleLimit, config.exchangePriority, config.quotePriority);
      const selected = resolved.instrument;
      return { assetType: "CEX", asset: selected.asset, symbol: selected.key, requestedSymbol: instrument.key, exchange: selected.exchange, instrumentId: selected.instrumentId, timeframe, ...analyzeCandles(resolved.candles, timeframe) };
    } catch (error) {
      return { assetType: "CEX", symbol: instrument.key, exchange: instrument.exchange, instrumentId: instrument.instrumentId, timeframe, status: "ERROR", error: error.message };
    }
  });
}

async function scanFocusItems(items) {
  return mapLimited(items, config.requestConcurrency, async item => {
    try {
      const instrument = parseInstrument(`${item.exchange}:${item.instrumentId}`);
      const candles = await fetchFromExchange(instrument, item.timeframe, Math.min(config.candleLimit, 1000));
      return { assetType: "FOCUS", symbol: item.asset, exchange: item.exchange, instrumentId: item.instrumentId, timeframe: item.timeframe, expectedDirection: item.direction, expiresAt: item.expiresAt, ...analyzeCandles(candles, item.timeframe) };
    } catch (error) {
      return { assetType: "FOCUS", symbol: item.asset, exchange: item.exchange, instrumentId: item.instrumentId, timeframe: item.timeframe, expectedDirection: item.direction, expiresAt: item.expiresAt, status: "ERROR", error: error.message };
    }
  });
}

function parseDexTokens(input) {
  const supported = new Set(config.dex.networks);
  const tokens = new Map();
  for (const item of Array.isArray(input) ? input : []) {
    const network = String(item.network ?? "").trim().toLowerCase();
    const tokenAddress = String(item.tokenAddress ?? "").trim();
    if (!supported.has(network)) throw new Error(`Mạng chưa được hỗ trợ: ${network}`);
    if (!/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{25,70})$/.test(tokenAddress)) throw new Error(`Token address không hợp lệ: ${tokenAddress}`);
    tokens.set(`${network}:${tokenAddress}`, { network, tokenAddress });
  }
  return [...tokens.values()];
}

async function scanDex(tokens, timeframe) {
  return mapLimited(tokens, 2, async token => {
    try {
      if (timeframe === "1W" && !process.env.COINGECKO_API_KEY) throw new Error("W1 DEX cần CoinGecko Onchain Analyst API key");
      const requiredDaily = timeframe === "1W" ? 700 : 100;
      const market = await fetchDexDailyCandles(token, { ...config.dex, apiKey: process.env.COINGECKO_API_KEY }, requiredDaily);
      return {
        assetType: "DEX", exchange: "GECKOTERMINAL", instrumentId: market.tokenSymbol,
        network: market.network, tokenAddress: market.tokenAddress, poolAddress: market.poolAddress,
        poolName: market.poolName, dex: market.dex, liquidityUsd: market.liquidityUsd, timeframe,
        quoteSymbol: market.quoteSymbol,
        ...analyzeCandles(market.candles, timeframe)
      };
    } catch (error) {
      return { assetType: "DEX", exchange: "GECKOTERMINAL", instrumentId: token.tokenAddress.slice(0, 10), network: token.network, tokenAddress: token.tokenAddress, status: "ERROR", error: error.message };
    }
  });
}

function effectiveAutomation(settings) {
  return { ...settings, telegram: { ...settings.telegram, chatId: settings.telegram.chatId || String(process.env.TELEGRAM_CHAT_ID || "").trim() } };
}

function formatAutomationReport(timeframe, rows, delivery, settings, trigger) {
  const icons = { BUY: "🟢", SELL: "🔴", BOTH: "🟡", ERROR: "⚠️" };
  const lines = [`📊 Trading Signal · ${timeframe}`, `Thời điểm: ${new Date().toLocaleString("vi-VN", { timeZone: settings.timezone })}`, `Chế độ: ${trigger === "schedule" ? "Tự động" : "Chạy thủ công"}`, ""];
  for (const row of delivery.delivered) {
    const types = [...(row.buyTypes || []), ...(row.sellTypes || []), ...(row.warnings || []), ...(row.exitTypes || []), ...(row.trendTypes || [])].join(", ") || row.status;
    const market = row.assetType === "DEX" ? `${row.network} · ${row.dex || "DEX"}` : row.exchange;
    lines.push(`${icons[row.status] || "•"} ${row.instrumentId || row.symbol} · ${market}`);
    lines.push(`Tín hiệu: ${row.status} (${types}) · Giá đóng: ${row.close ?? "—"}`);
    if (row.assetType === "DEX") lines.push(`Contract: ${row.tokenAddress}`, `Pool: ${row.poolName || row.poolAddress || "—"}`);
    lines.push("");
  }
  if (settings.telegram.sendErrors) {
    for (const row of rows.filter(item => item.status === "ERROR")) lines.push(`${icons.ERROR} ${row.instrumentId || row.symbol}: ${row.error}`);
  }
  const counts = delivery.delivered.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }), {});
  const errorCount = rows.filter(row => row.status === "ERROR").length;
  if (delivery.delivered.length === 0 && settings.telegram.sendNoSignalSummary) lines.push(trigger === "schedule" ? "Không có tín hiệu BUY/SELL mới trên nến vừa đóng." : "Không có tín hiệu BUY/SELL trên nến hiện tại.");
  if (delivery.suppressed) lines.push(`Đã bỏ qua ${delivery.suppressed} tín hiệu đã gửi trước đó.`);
  lines.push(`Đã quét: ${rows.length} · Tín hiệu gửi: BUY ${counts.BUY || 0} · SELL ${counts.SELL || 0} · BOTH ${counts.BOTH || 0} · ERROR ${errorCount}`);
  return lines.join("\n");
}

async function runAutomation(timeframe, trigger = "manual") {
  const settings = effectiveAutomation(await loadAutomation(automationPath));
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Chưa cấu hình TELEGRAM_BOT_TOKEN trong .env");
  if (!settings.telegram.chatId) throw new Error("Chưa cấu hình Telegram Chat ID");

  const rows = [];
  if (settings.assets.cex.enabled && settings.assets.cex.watchlist.length) rows.push(...await scan(normalizeInstruments(settings.assets.cex.watchlist), timeframe));
  if (settings.assets.dex.enabled && settings.assets.dex.watchlist.length) rows.push(...await scanDex(parseDexTokens(settings.assets.dex.watchlist), timeframe));
  if (!rows.length) throw new Error("Watchlist tự động đang trống");

  const state = await loadAutomationState(automationStatePath);
  const delivery = selectDeliverySignals(rows, state.sentKeys, timeframe, trigger);

  const shouldSend = delivery.delivered.length > 0 || (settings.telegram.sendErrors && rows.some(row => row.status === "ERROR")) || settings.telegram.sendNoSignalSummary;
  if (shouldSend) await sendTelegramText(token, settings.telegram.chatId, formatAutomationReport(timeframe, rows, delivery, settings, trigger));

  state.sentKeys = delivery.sentKeys;
  state.lastRuns = { ...(state.lastRuns || {}), [`crypto:${timeframe}`]: { at: Date.now(), assetGroup: "crypto", timeframe, trigger, total: rows.length, detectedSignals: delivery.detected.length, sentSignals: delivery.delivered.length, suppressedSignals: delivery.suppressed, errors: rows.filter(row => row.status === "ERROR").length, status: "OK" } };
  await saveAutomationState(automationStatePath, state);
  return { timeframe, total: rows.length, detectedSignals: delivery.detected.length, sentSignals: delivery.delivered.length, suppressedSignals: delivery.suppressed, errors: rows.filter(row => row.status === "ERROR").length, messageSent: shouldSend };
}

function focusDirectionMatched(row) {
  return row.expectedDirection === "BUY" ? Boolean(row.buyTypes?.length) : Boolean(row.sellTypes?.length);
}

async function runFocusAutomation(trigger = "manual") {
  const settings = effectiveAutomation(await loadAutomation(automationPath));
  const now = Date.now();
  const focus = await loadFocusList(focusPath, now);
  const active = focus.items.filter(item => item.expiresAt > now);
  if (!active.length) return { total: 0, matchedSignals: 0, sentSignals: 0, errors: 0, messageSent: false };
  const rows = await scanFocusItems(active);
  const matched = rows.filter(focusDirectionMatched).map(row => ({ ...row, status: row.expectedDirection }));
  const state = await loadAutomationState(automationStatePath);
  const delivery = selectDeliverySignals(matched, state.sentKeys, "FOCUS", trigger);
  const errors = rows.filter(row => row.status === "ERROR");
  const shouldSend = delivery.delivered.length > 0 || (settings.telegram.sendErrors && errors.length > 0);
  if (shouldSend) {
    const lines = ["🎯 Trading Signal · Điểm vào khung nhỏ", `Thời điểm: ${new Date().toLocaleString("vi-VN", { timeZone: settings.timezone })}`, ""];
    for (const row of delivery.delivered) {
      const types = row.expectedDirection === "BUY" ? row.buyTypes : row.sellTypes;
      lines.push(`${row.expectedDirection === "BUY" ? "🟢" : "🔴"} ${row.symbol} · ${row.exchange}`, `Điểm vào: ${row.expectedDirection} (${types.join(", ")}) · ${row.timeframe}`, `Giá đóng: ${row.close} · Nến: ${new Date(row.candleOpenTime).toLocaleString("vi-VN", { timeZone: "UTC" })}`, "");
    }
    if (settings.telegram.sendErrors) for (const row of errors) lines.push(`⚠️ ${row.symbol} · ${row.exchange}: ${row.error}`);
    await sendTelegramText(process.env.TELEGRAM_BOT_TOKEN, settings.telegram.chatId, lines.join("\n"));
  }
  state.sentKeys = delivery.sentKeys;
  state.lastRuns = { ...(state.lastRuns || {}), focus: { at: now, assetGroup: "focus", trigger, total: rows.length, detectedSignals: matched.length, sentSignals: delivery.delivered.length, errors: errors.length, status: "OK" } };
  await saveAutomationState(automationStatePath, state);
  return { total: rows.length, matchedSignals: matched.length, sentSignals: delivery.delivered.length, errors: errors.length, messageSent: shouldSend, results: trigger === "manual" ? rows : undefined };
}

let schedulerBusy = false;
async function schedulerTick() {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    const settings = effectiveAutomation(await loadAutomation(automationPath));
    if (!settings.enabled) return;
    const clock = localClock(new Date(), settings.timezone);
    const jobs = [
      { key: "cryptoDaily", timeframe: "1D", due: settings.schedules.cryptoDaily.enabled && clock.time === settings.schedules.cryptoDaily.time },
      { key: "cryptoWeekly", timeframe: "1W", due: settings.schedules.cryptoWeekly.enabled && clock.day === settings.schedules.cryptoWeekly.day && clock.time === settings.schedules.cryptoWeekly.time },
      { key: "focusScan", timeframe: "FOCUS", due: settings.schedules.focusScan.enabled && Number(clock.time.slice(3)) === settings.schedules.focusScan.minute }
    ];
    for (const job of jobs.filter(item => item.due)) {
      const slot = `${clock.date}|${clock.time}`;
      const state = await loadAutomationState(automationStatePath);
      if (state.lastSlots?.[job.key] === slot) continue;
      state.lastSlots = { ...(state.lastSlots || {}), [job.key]: slot };
      await saveAutomationState(automationStatePath, state);
      try { job.timeframe === "FOCUS" ? await runFocusAutomation("schedule") : await runAutomation(job.timeframe, "schedule"); }
      catch (error) {
        const latest = await loadAutomationState(automationStatePath);
        const runKey = job.timeframe === "FOCUS" ? "focus" : `crypto:${job.timeframe}`;
        latest.lastRuns = { ...(latest.lastRuns || {}), [runKey]: { at: Date.now(), assetGroup: job.timeframe === "FOCUS" ? "focus" : "crypto", timeframe: job.timeframe, trigger: "schedule", status: "ERROR", error: error.message } };
        await saveAutomationState(automationStatePath, latest);
        console.error(`Automation ${job.timeframe}: ${error.message}`);
      }
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

    if (url.pathname === "/api/config") return json(res, 200, { ...config, app: { name: "Trading Signal", version: packageInfo.version }, capabilities: { dexWeekly: Boolean(process.env.COINGECKO_API_KEY), telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN), stocks: false } });
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
      if (candidate.enabled && !hasCex && !hasDex) return json(res, 400, { error: "Cần bật ít nhất một watchlist CEX hoặc DEX có dữ liệu" });
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
    if (url.pathname === "/api/focus" && req.method === "GET") {
      const data = await loadFocusList(focusPath);
      return json(res, 200, { items: data.items, now: Date.now() });
    }
    if (url.pathname === "/api/focus" && req.method === "POST") {
      const request = await readJsonBody(req);
      const entry = await upsertFocusEntry(focusPath, request);
      return json(res, 200, { entry, saved: true });
    }
    if (url.pathname === "/api/focus/run" && req.method === "POST") return json(res, 200, await runFocusAutomation("manual"));
    const focusMatch = url.pathname.match(/^\/api\/focus\/([A-Z0-9]+)(?:\/(extend))?$/i);
    if (focusMatch && req.method === "POST" && focusMatch[2] === "extend") return json(res, 200, { entry: await extendFocusEntry(focusPath, focusMatch[1]) });
    if (focusMatch && req.method === "DELETE" && !focusMatch[2]) return json(res, (await deleteFocusEntry(focusPath, focusMatch[1])) ? 200 : 404, { deleted: true });
    if (url.pathname === "/api/scan" && req.method === "POST") {
      const request = await readJsonBody(req);
      const timeframe = request.timeframe === "1W" ? "1W" : "1D";
      const instruments = normalizeInstruments(request.symbols ?? config.symbols);
      if (!instruments.length) return json(res, 400, { error: "Danh sách coin trống" });
      return json(res, 200, { generatedAt: Date.now(), timeframe, closedBarsOnly: true, results: await scan(instruments, timeframe) });
    }
    if (url.pathname === "/api/scan/dex" && req.method === "POST") {
      const request = await readJsonBody(req);
      const timeframe = request.timeframe === "1W" ? "1W" : "1D";
      const tokens = parseDexTokens(request.tokens);
      if (!tokens.length) return json(res, 400, { error: "Danh sách token address trống" });
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
  setInterval(schedulerTick, 30_000).unref();
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
