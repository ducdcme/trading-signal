const DAY_MS = 86_400_000;
const STOCK_CLOSE_MS = (15 * 60 + 15) * 60 * 1000;

export function normalizeStockSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{2,20}$/.test(symbol)) throw new Error("Mã chứng khoán không hợp lệ");
  return symbol;
}

export function parseStockSymbolList(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[\s,;]+/);
  const normalized = values.map(item => String(item || "").trim()).filter(Boolean).map(normalizeStockSymbol);
  return [...new Set(normalized)];
}

function candleStart(dateText) {
  const value = Date.parse(`${dateText}T00:00:00+07:00`);
  if (!Number.isFinite(value)) throw new Error(`Ngày nến chứng khoán không hợp lệ: ${dateText}`);
  return value;
}

export function normalizeStockCandles(rows) {
  if (!Array.isArray(rows)) throw new Error("Stocks API không trả danh sách nến");
  return rows.map(row => {
    const openTime = candleStart(row.date);
    const prices = [row.open, row.high, row.low, row.close].map(Number);
    if (!prices.every(value => Number.isFinite(value) && value > 0)) throw new Error(`Nến ${row.date} có giá không hợp lệ`);
    const volume = Number(row.volume || 0);
    if (!Number.isFinite(volume) || volume < 0) throw new Error(`Nến ${row.date} có volume không hợp lệ`);
    return { openTime, open: prices[0], high: prices[1], low: prices[2], close: prices[3], volume, closeTime: openTime + STOCK_CLOSE_MS };
  }).sort((a, b) => a.openTime - b.openTime);
}

async function fetchCollector(path, { baseUrl, timeoutMs = 10_000, fetchImpl = fetch, method = "GET", body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await fetchImpl(new URL(path, `${String(baseUrl).replace(/\/$/, "")}/`), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { throw new Error("Stocks API không trả dữ liệu JSON"); }
    if (!response.ok) throw new Error(payload.detail || payload.error || `Stocks API HTTP ${response.status}`);
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Stocks API quá thời gian phản hồi");
    throw error;
  } finally { clearTimeout(timer); }
}

export async function fetchStockSymbols(options) {
  const payload = await fetchCollector("symbols", options);
  if (!Array.isArray(payload.symbols)) throw new Error("Stocks API không trả danh sách mã");
  return payload.symbols.map(item => ({ symbol: normalizeStockSymbol(item.symbol), exchange: String(item.exchange || "VN").toUpperCase(), name: String(item.name || item.symbol) }));
}

export async function fetchStockCandles(symbol, limit, options) {
  const normalized = normalizeStockSymbol(symbol);
  const query = new URLSearchParams({ symbol: normalized, limit: String(Math.min(Math.max(Number(limit) || 500, 20), 2000)) });
  const payload = await fetchCollector(`candles/d1?${query}`, options);
  return { symbol: normalized, provider: payload.provider, candles: normalizeStockCandles(payload.candles) };
}

export function summarizeStockCandles(candles) {
  if (!Array.isArray(candles) || candles.length < 2) throw new Error("Không đủ nến để tính biến động D1");
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const close = Number(latest.close);
  const previousClose = Number(previous.close);
  const changePercent = previousClose > 0 ? ((close - previousClose) / previousClose) * 100 : null;
  return {
    close,
    previousClose,
    changePercent,
    openTime: latest.openTime,
    volume: latest.volume
  };
}


export function classifyStockPrepareResult(result, wasActive = false) {
  if (result?.backfill?.skipped) return "prepared";
  if (wasActive) return "retried";
  return "added";
}

export async function addStockInstrument(symbol, years = 3, options) {
  const normalized = normalizeStockSymbol(symbol);
  return fetchCollector("admin/instruments", {
    ...options,
    method: "POST",
    body: { symbol: normalized, years: Math.min(Math.max(Number(years) || 3, 1), 10) }
  });
}

export async function removeStockInstrument(symbol, options) {
  const normalized = normalizeStockSymbol(symbol);
  return fetchCollector(`admin/instruments/${encodeURIComponent(normalized)}`, {
    ...options,
    method: "DELETE"
  });
}


export async function fetchStockUniverseGroups(options) {
  const payload = await fetchCollector("universe/groups", options);
  if (!Array.isArray(payload.groups)) throw new Error("Stocks API không trả danh sách nhóm quét");
  return payload.groups.map(row => ({
    group: String(row.group || "").toUpperCase(),
    provider: String(row.provider || "database"),
    total: Number(row.total || 0),
    preparedCount: Number(row.preparedCount || 0),
    missingCount: Number(row.missingCount || 0),
    prepared: Array.isArray(row.prepared) ? row.prepared.map(item => ({ symbol: normalizeStockSymbol(item.symbol), exchange: String(item.exchange || "VN").toUpperCase(), name: String(item.name || item.symbol) })) : [],
    missing: Array.isArray(row.missing) ? row.missing.map(normalizeStockSymbol) : []
  }));
}

export async function syncStockDaily(symbols, options) {
  const normalized = parseStockSymbolList(symbols || []);
  const query = new URLSearchParams();
  if (normalized.length) query.set("symbols", normalized.join(","));
  return fetchCollector(`admin/sync/daily${query.size ? `?${query}` : ""}`, { ...options, method: "POST" });
}
