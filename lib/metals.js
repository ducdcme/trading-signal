const DAY_MS = 86_400_000;
const TROY_OUNCE_GRAMS = 31.1034768;
const LUONG_GRAMS = 37.5;
const KILOGRAM_GRAMS = 1000;

export const METAL_PRODUCTS = Object.freeze({
  VN_GOLD_SJC_BAR: { name: "Vàng miếng SJC", market: "VIETNAM", currency: "VND", unit: "LUONG", sides: ["BUY", "SELL"] },
  VN_GOLD_RING_9999: { name: "Nhẫn trơn 9999", market: "VIETNAM", currency: "VND", unit: "LUONG", sides: ["BUY", "SELL"] },
  VN_SILVER_999_KG: { name: "Bạc 999", market: "VIETNAM", currency: "VND", unit: "KG", sides: ["BUY", "SELL"] },
  XAU_USD: { name: "Vàng thế giới", market: "WORLD", currency: "USD", unit: "TROY_OUNCE", sides: ["MID"] },
  XAG_USD: { name: "Bạc thế giới", market: "WORLD", currency: "USD", unit: "TROY_OUNCE", sides: ["MID"] },
  USD_VND: { name: "Tỷ giá USD/VND", market: "WORLD", currency: "VND", unit: "USD", sides: ["MID"] }
});

export const METAL_ALERT_PRODUCTS = Object.freeze([
  "VN_GOLD_SJC_BAR",
  "VN_GOLD_RING_9999",
  "VN_SILVER_999_KG"
]);

export function normalizeMetalSelection(productCode, side) {
  const product = String(productCode || "").trim().toUpperCase();
  const meta = METAL_PRODUCTS[product];
  if (!meta) throw new Error("Mã kim loại không hợp lệ");
  const requestedSide = String(side || (meta.market === "WORLD" ? "MID" : "SELL")).toUpperCase();
  if (!meta.sides.includes(requestedSide)) throw new Error("Chiều giá không hợp lệ");
  return { productCode: product, side: requestedSide, meta };
}

function candleStart(dateText, market) {
  const suffix = market === "VIETNAM" ? "T00:00:00+07:00" : "T00:00:00Z";
  const value = Date.parse(`${dateText}${suffix}`);
  if (!Number.isFinite(value)) throw new Error(`Ngày nến không hợp lệ: ${dateText}`);
  return value;
}

export function normalizeMetalCandles(rows, selection) {
  if (!Array.isArray(rows)) throw new Error("Metals API không trả danh sách nến");
  const normalized = rows.map(row => {
    const openTime = candleStart(row.date, selection.meta.market);
    const values = [row.open, row.high, row.low, row.close].map(Number);
    if (!values.every(value => Number.isFinite(value) && value > 0)) {
      throw new Error(`Nến ${row.date} có giá không hợp lệ`);
    }
    return {
      openTime,
      open: values[0], high: values[1], low: values[2], close: values[3],
      volume: Number(row.sampleCount || 0), closeTime: openTime + DAY_MS - 1,
      sourceQuality: row.quality, isComplete: row.isComplete === true,
      ohlcMode: "OBSERVED"
    };
  }).sort((a, b) => a.openTime - b.openTime);

  if (selection.meta.market !== "VIETNAM") return normalized;
  return normalized.map((candle, index) => {
    const previous = normalized[index - 1];
    const flatSingleSample = candle.volume <= 1
      && candle.open === candle.high
      && candle.high === candle.low
      && candle.low === candle.close;
    if (!previous || !flatSingleSample) return candle;
    const open = previous.close;
    return {
      ...candle,
      open,
      high: Math.max(open, candle.close),
      low: Math.min(open, candle.close),
      ohlcMode: "PREVIOUS_CLOSE_DERIVED"
    };
  });
}

async function fetchCollector(path, { baseUrl, timeoutMs = 10_000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(new URL(path, `${String(baseUrl).replace(/\/$/, "")}/`), {
      headers: { accept: "application/json" }, signal: controller.signal
    });
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch { throw new Error("Metals API không trả dữ liệu JSON"); }
    if (!response.ok) throw new Error(payload.error || `Metals API HTTP ${response.status}`);
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Metals API quá thời gian phản hồi");
    throw error;
  } finally { clearTimeout(timer); }
}

export async function fetchMetalsLatest(options) {
  return fetchCollector("latest", options);
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function referencePrice(item) {
  return positiveNumber(item?.price ?? item?.close);
}

function comparisonSide(value, benchmark) {
  const price = positiveNumber(value);
  if (price === null || benchmark === null) return null;
  const difference = price - benchmark;
  return { price, difference, percent: difference / benchmark * 100 };
}

export function buildMetalComparison(payload) {
  if (!payload || !Array.isArray(payload.products)) throw new Error("Metals API không trả danh sách sản phẩm");
  const products = new Map(payload.products.map(item => [item.productId, item]));
  const xauUsd = referencePrice(products.get("XAU_USD"));
  const xagUsd = referencePrice(products.get("XAG_USD"));
  const usdVnd = referencePrice(products.get("USD_VND"));
  if (xauUsd === null || xagUsd === null || usdVnd === null) {
    throw new Error("Thiếu XAU/USD, XAG/USD hoặc USD/VND để quy đổi");
  }

  const goldVndPerLuong = xauUsd * usdVnd * LUONG_GRAMS / TROY_OUNCE_GRAMS;
  const silverVndPerKg = xagUsd * usdVnd * KILOGRAM_GRAMS / TROY_OUNCE_GRAMS;
  const definitions = [
    ["VN_GOLD_SJC_BAR", "XAU_USD", goldVndPerLuong],
    ["VN_GOLD_RING_9999", "XAU_USD", goldVndPerLuong],
    ["VN_SILVER_999_KG", "XAG_USD", silverVndPerKg]
  ];

  const rows = definitions.map(([productId, referenceProductId, benchmark]) => {
    const item = products.get(productId);
    if (!item) return { productId, referenceProductId, benchmark, buy: null, sell: null, missing: true };
    return {
      productId, referenceProductId, benchmark,
      buy: comparisonSide(item.buy, benchmark),
      sell: comparisonSide(item.sell, benchmark),
      provider: item.provider,
      sourceUpdatedAt: item.sourceUpdatedAt,
      missing: false
    };
  });

  return {
    generatedAt: payload.generatedAt,
    inputs: { xauUsd, xagUsd, usdVnd },
    benchmarks: { goldVndPerLuong, silverVndPerKg },
    rows
  };
}

export async function fetchMetalCandles(productCode, side, limit, options) {
  const selection = normalizeMetalSelection(productCode, side);
  const query = new URLSearchParams({
    product: selection.productCode, side: selection.side,
    limit: String(Math.min(Math.max(Number(limit) || 500, 100), 1000)),
    complete: options?.completeOnly === true ? "true" : "false"
  });
  const payload = await fetchCollector(`candles/d1?${query}`, options);
  return { selection, candles: normalizeMetalCandles(payload.candles, selection) };
}
