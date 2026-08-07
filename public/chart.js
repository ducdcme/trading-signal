import { formatChartDate } from "./chart-time.js";
import {
  beginMeasurement,
  completeMeasurement,
  measurementPointFromCanvas,
  measurementPointToCanvas,
  measurementStats,
  previewMeasurement
} from "./chart-measure.js";
import { buildSmcLayers } from "./smc.js";
import { distanceBetweenPointers, midpointBetweenPointers, pinchBarCount, plotAnchorRatio } from "./chart-gestures.js";
import { chartReturnUrl, normalizeAppTab } from "./navigation-state.js";

const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
let exchange = String(params.get("exchange") || "AUTO").toUpperCase();
let symbol = String(params.get("symbol") || "BTC").toUpperCase();
let timeframe = ["1H", "4H", "8H", "1D", "1W"].includes(params.get("timeframe")) ? params.get("timeframe") : "1D";
const returnTab = normalizeAppTab(params.get("returnTab"));
let payload = null;
let layout = null;
let yScaleFactor = 1;
let yCenterOffset = 0;
let yScaleDrag = null;
let chartDrag = null;
let pinchGesture = null;
const touchPointers = new Map();
let crosshair = null;
let measurement = null;
let smcLayers = null;
let visibleBarCount = 160;
let rightOffset = 0;
const futureBarCount = 20;
const chartWorkspaceKey = "trading-signal:chart-workspace:v1";
const smcPreferencesKey = "trading-signal:smc-preferences:v4";
const legacySmcPreferencesKey = "trading-signal:smc-preferences:v3";
const smcControlIds = ["showSwingStructure", "showInternalStructure", "showOrderBlocks", "showFairValueGaps", "showEqualLevels", "showPremiumZone", "showDiscountZone", "showEquilibrium"];
const quoteRefreshMs = 15_000;
let chartItems = [];
let quotesByKey = new Map();
let quoteTimer = null;
let loadSequence = 0;

const canvas = $("#chart");
const context = canvas.getContext("2d");
const h = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
$("#backToList").href = chartReturnUrl(returnTab);
const displayType = type => type === "EXT_SHORT" ? "extS" : type === "EXT_LONG" ? "extL" : type;
const formatPrice = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-US", { maximumSignificantDigits: 9 }) : "—";
const formatDate = value => formatChartDate(value, timeframe);
const timeframeMs = () => ({ "1H": 3_600_000, "4H": 14_400_000, "8H": 28_800_000, "1D": 86_400_000, "1W": 604_800_000 })[timeframe] || 86_400_000;
const itemKey = item => `${String(item.exchange).toUpperCase()}:${String(item.symbol || item.instrumentId).toUpperCase()}`;

function readSmcPreferences() {
  try {
    const current = JSON.parse(localStorage.getItem(smcPreferencesKey) || "null");
    const legacy = current ? null : JSON.parse(localStorage.getItem(legacySmcPreferencesKey) || "null");
    const saved = current || legacy;
    for (const id of smcControlIds) if (typeof saved?.[id] === "boolean") $(`#${id}`).checked = saved[id];
    if (!current) $(`#showEqualLevels`).checked = true;
    if (legacy) saveSmcPreferences();
  } catch { /* dùng mặc định trên giao diện */ }
}

function saveSmcPreferences() {
  try {
    localStorage.setItem(smcPreferencesKey, JSON.stringify(Object.fromEntries(smcControlIds.map(id => [id, $(`#${id}`).checked]))));
  } catch { /* chỉ mất tùy chọn sau reload */ }
}

function normalizeChartItem(item) {
  const itemExchange = String(item?.exchange || "AUTO").toUpperCase();
  const itemSymbol = String(item?.symbol || item?.instrumentId || "").trim().toUpperCase();
  return itemSymbol ? { exchange: itemExchange, symbol: itemSymbol } : null;
}

function readChartWorkspace() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(chartWorkspaceKey) || "null"); } catch { /* dùng coin trên URL */ }
  const urlItem = normalizeChartItem({ exchange, symbol });
  const items = [...(Array.isArray(saved?.items) ? saved.items : []), urlItem].map(normalizeChartItem).filter(Boolean);
  chartItems = items.filter((item, index, all) => all.findIndex(other => itemKey(other) === itemKey(item)) === index).slice(0, 100);
  const requestedKey = `${exchange}:${symbol}`;
  if (!chartItems.some(item => itemKey(item) === requestedKey)) chartItems.unshift(urlItem);
}

function saveChartWorkspace() {
  try {
    localStorage.setItem(chartWorkspaceKey, JSON.stringify({ selected: `${exchange}:${symbol}`, timeframe, items: chartItems }));
  } catch { /* danh sách vẫn hoạt động trong phiên hiện tại */ }
}

function formatQuotePrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const digits = number >= 1000 ? 2 : number >= 1 ? 4 : 8;
  return number.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function renderChartList() {
  $("#chartListCount").textContent = String(chartItems.length);
  if (!chartItems.length) {
    $("#chartCoinList").innerHTML = '<div class="chart-list-empty">Nhập mã coin phía trên để bắt đầu.</div>';
    return;
  }
  $("#chartCoinList").innerHTML = chartItems.map(item => {
    const key = itemKey(item);
    const quote = quotesByKey.get(key);
    const selected = key === `${exchange}:${symbol}`;
    const change = Number(quote?.changePercent);
    const available = Number.isFinite(change);
    const changeClass = !available ? "unavailable" : change < 0 ? "down" : "up";
    const changeText = available ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%` : quote?.error ? "Lỗi" : "…";
    const displaySymbol = quote?.instrumentId || item.symbol;
    return `<button class="chart-coin-row${selected ? " selected" : ""}" type="button" data-select-key="${h(key)}"><span class="chart-pair"><strong>${h(displaySymbol)}</strong><small>${h(quote?.exchange || item.exchange)}</small></span><span class="chart-quote-price">${h(formatQuotePrice(quote?.price))}</span><span class="chart-change ${changeClass}">${h(changeText)}</span><span class="chart-remove" role="button" tabindex="0" title="Xóa khỏi danh sách" data-remove-key="${h(key)}">×</span></button>`;
  }).join("");
}

async function refreshQuotes({ announce = false } = {}) {
  clearTimeout(quoteTimer);
  if (!chartItems.length || document.hidden) {
    quoteTimer = setTimeout(() => refreshQuotes(), quoteRefreshMs);
    return;
  }
  if (announce) $("#chartListState").textContent = "Đang cập nhật giá…";
  try {
    const response = await fetch("/api/market/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: chartItems }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    for (const quote of data.quotes) {
      const requestedKey = quote.requested ? `${quote.requested.exchange}:${quote.requested.symbol}` : `${quote.exchange}:${quote.symbol || quote.instrumentId}`;
      quotesByKey.set(requestedKey, quote);
      if (quote.instrumentId) quotesByKey.set(`${quote.exchange}:${quote.instrumentId}`, quote);
    }
    $("#chartListState").textContent = `Giá D1 cập nhật ${new Date(data.generatedAt).toLocaleTimeString("vi-VN")}`;
    renderChartList();
  } catch (error) {
    $("#chartListState").textContent = `Không cập nhật được giá: ${error.message}`;
  } finally {
    quoteTimer = setTimeout(() => refreshQuotes(), quoteRefreshMs);
  }
}

function selectChartItem(item) {
  exchange = item.exchange;
  symbol = item.symbol;
  saveChartWorkspace();
  renderChartList();
  load();
}

function updateYScaleLabel() {
  const automatic = Math.abs(yScaleFactor - 1) < 0.001 && Math.abs(yCenterOffset) < 0.001;
  $("#autoScale").textContent = automatic ? "Trục Y: Tự động" : `Trục Y: ${yScaleFactor.toFixed(2)}×`;
  $("#autoScale").classList.toggle("manual", !automatic);
}

function setYScale(factor = 1) {
  yScaleFactor = Math.min(12, Math.max(0.12, factor));
  updateYScaleLabel();
  draw();
}

function resetYScale() {
  yCenterOffset = 0;
  setYScale(1);
}

function trendEmaLine(candles, x, y) {
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1], current = candles[index];
    if (!Number.isFinite(previous.ema21) || !Number.isFinite(current.ema21)) continue;
    context.beginPath(); context.moveTo(x(index - 1), y(previous.ema21)); context.lineTo(x(index), y(current.ema21));
    context.strokeStyle = current.ema55 > current.ema21 ? "#ff6478" : "#22c78d";
    context.lineWidth = 1; context.stroke();
  }
}

function rightOffsetBounds(count = visibleBarCount) {
  const candleCount = payload?.candles.length || 0;
  const virtualLength = candleCount + futureBarCount;
  const maximumFutureBars = Math.max(futureBarCount, Math.floor(count / 2));
  return {
    min: futureBarCount - maximumFutureBars,
    max: Math.max(0, virtualLength - Math.min(count, virtualLength))
  };
}

function clampRightOffset(value, count = visibleBarCount) {
  const bounds = rightOffsetBounds(count);
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

function setVisibleBarCount(count, anchorRatio = 0.5) {
  const available = (payload?.candles.length || 500) + futureBarCount;
  const previousCount = visibleBarCount;
  const previousStart = Math.max(0, available - rightOffset - previousCount);
  const anchorIndex = previousStart + previousCount * anchorRatio;
  visibleBarCount = Math.round(Math.min(500, Math.max(30, count)));
  const nextStart = anchorIndex - visibleBarCount * anchorRatio;
  rightOffset = Math.round(clampRightOffset(available - nextStart - visibleBarCount, visibleBarCount));
  const custom = $("#customVisibleBars");
  custom.value = String(visibleBarCount); custom.textContent = `${visibleBarCount} (zoom)`; custom.hidden = false;
  $("#visibleBars").value = String(visibleBarCount);
  draw();
}

function resetView() {
  rightOffset = 0;
  resetYScale();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function line(points, color, width = 1.5) {
  context.beginPath();
  let started = false;
  for (const point of points) {
    if (!Number.isFinite(point.y)) { started = false; continue; }
    if (!started) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
    started = true;
  }
  context.strokeStyle = color; context.lineWidth = width; context.stroke();
}

function triangle(x, y, direction, color, faded) {
  const size = 5;
  context.save(); context.globalAlpha = faded ? 0.55 : 1; context.fillStyle = color; context.beginPath();
  if (direction === "up") { context.moveTo(x, y - size); context.lineTo(x - size, y + size); context.lineTo(x + size, y + size); }
  else { context.moveTo(x, y + size); context.lineTo(x - size, y - size); context.lineTo(x + size, y - size); }
  context.closePath(); context.fill(); context.restore();
}

function signalLabel(type, x, y, color, align) {
  const faded = type === "EXT_SHORT" || type === "EXT_LONG";
  context.save(); context.globalAlpha = faded ? 0.6 : 0.95; context.fillStyle = color;
  context.font = "bold 9px system-ui"; context.textAlign = "center"; context.textBaseline = align;
  context.fillText(displayType(type), x, y); context.restore();
}

function signalGroup(types, x, candleY, direction, color) {
  if (!types.length) return;
  const arrowY = candleY + (direction === "up" ? 9 : -9);
  const arrowFaded = types.every(type => type === "EXT_SHORT" || type === "EXT_LONG");
  triangle(x, arrowY, direction, color, arrowFaded);
  if (direction === "up") {
    types.forEach((type, index) => signalLabel(type, x, arrowY + 8 + index * 12, color, "top"));
    return;
  }
  types.forEach((type, index) => signalLabel(type, x, arrowY - 8 - (types.length - 1 - index) * 12, color, "bottom"));
}

function smcTrendText(trend) {
  return trend > 0 ? "Tăng" : trend < 0 ? "Giảm" : "Chưa xác định";
}

function updateSmcTrend() {
  const badge = $("#smcTrend");
  const showSwing = $("#showSwingStructure").checked;
  const showInternal = $("#showInternalStructure").checked;
  if ((!showSwing && !showInternal) || !smcLayers) {
    badge.textContent = "SMC: Tắt";
    badge.className = "smc-trend neutral";
    return;
  }
  if (showSwing && showInternal) {
    const swing = smcLayers.swing.trend, internal = smcLayers.internal.trend;
    badge.textContent = `Swing ${smcTrendText(swing)} · Internal ${smcTrendText(internal)}`;
    badge.className = `smc-trend ${swing && internal && swing !== internal ? "mixed" : swing > 0 || internal > 0 ? "bullish" : swing < 0 || internal < 0 ? "bearish" : "neutral"}`;
    return;
  }
  const mode = showSwing ? "swing" : "internal";
  const trend = smcLayers[mode].trend;
  badge.textContent = `${mode === "swing" ? "Swing" : "Internal"}: ${smcTrendText(trend)}`;
  badge.className = `smc-trend ${trend > 0 ? "bullish" : trend < 0 ? "bearish" : "neutral"}`;
}

function drawSmcStructure(layer, { internal = false } = {}) {
  if (!layer || !layout) return;
  const { margin, width, height, step, startIndex, endIndex, min, max, plotHeight } = layout;
  const plotRight = width - margin.right;
  const x = index => margin.left + step * (index - startIndex + 0.5);
  const y = price => margin.top + (max - price) / (max - min) * plotHeight;
  const alpha = internal ? 0.32 : 0.48;

  context.save();
  context.beginPath(); context.rect(margin.left, margin.top, plotRight - margin.left, height - margin.top - margin.bottom); context.clip();
  for (const event of layer.breaks) {
    if (event.index < startIndex || event.pivotIndex >= endIndex) continue;
    const fromX = Math.max(margin.left, x(event.pivotIndex));
    const toX = Math.min(plotRight, x(event.index));
    if (toX < margin.left || fromX > plotRight) continue;
    const py = y(event.price);
    const bullish = event.direction === "BULLISH";
    const color = bullish ? `rgba(53,217,160,${alpha})` : `rgba(255,113,130,${alpha})`;
    context.strokeStyle = color; context.lineWidth = internal ? 0.8 : 1;
    context.setLineDash(event.type === "CHoCH" ? [2, 3] : [5, 4]);
    context.beginPath(); context.moveTo(fromX, py); context.lineTo(toX, py); context.stroke();
    context.setLineDash([]);
    context.globalAlpha = internal ? 0.58 : 0.72;
    context.fillStyle = color; context.font = `${internal ? 8 : 9}px system-ui`;
    context.textAlign = "center"; context.textBaseline = bullish ? "bottom" : "top";
    context.fillText(event.type, (fromX + toX) / 2, py + (bullish ? -3 : 3));
    context.globalAlpha = 1;
  }
  context.restore();
}

function drawSmcZones(zones, { label, bullishColor, bearishColor, limit = 8 } = {}) {
  if (!layout) return;
  const { margin, width, height, step, startIndex, endIndex, min, max, plotHeight } = layout;
  const plotRight = width - margin.right;
  const x = index => margin.left + step * (index - startIndex + 0.5);
  const y = price => margin.top + (max - price) / (max - min) * plotHeight;
  context.save();
  context.beginPath(); context.rect(margin.left, margin.top, plotRight - margin.left, height - margin.top - margin.bottom); context.clip();
  for (const zone of (zones || []).slice(-limit)) {
    const zoneEnd = zone.mitigatedIndex ?? endIndex;
    if (zoneEnd < startIndex || zone.index >= endIndex) continue;
    const left = Math.max(margin.left, x(zone.index));
    const right = Math.min(plotRight, x(Math.min(zoneEnd, endIndex)));
    const top = y(zone.top), bottom = y(zone.bottom);
    const bullish = zone.direction === "BULLISH";
    const color = bullish ? bullishColor : bearishColor;
    context.globalAlpha = zone.active ? 1 : 0.34;
    context.fillStyle = color.fill;
    context.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
    context.strokeStyle = color.stroke; context.lineWidth = 0.8; context.setLineDash([4, 4]);
    context.strokeRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
    context.setLineDash([]);
    context.fillStyle = color.stroke; context.font = "8px system-ui"; context.textAlign = "left"; context.textBaseline = "top";
    context.fillText(label, left + 3, top + 3);
  }
  context.restore();
}

function drawEqualLevels(levels) {
  if (!layout) return;
  const { margin, width, height, step, startIndex, endIndex, min, max, plotHeight } = layout;
  const plotRight = width - margin.right;
  const x = index => margin.left + step * (index - startIndex + 0.5);
  const y = price => margin.top + (max - price) / (max - min) * plotHeight;
  context.save();
  context.beginPath(); context.rect(margin.left, margin.top, plotRight - margin.left, height - margin.top - margin.bottom); context.clip();
  for (const level of (levels || []).slice(-12)) {
    if (level.index < startIndex || level.fromIndex >= endIndex) continue;
    const left = Math.max(margin.left, x(level.fromIndex)), right = Math.min(plotRight, x(level.index)), py = y(level.price);
    const color = level.type === "EQH" ? "rgba(255,173,185,.58)" : "rgba(111,230,194,.58)";
    context.strokeStyle = color; context.lineWidth = 0.8; context.setLineDash([2, 3]);
    context.beginPath(); context.moveTo(left, py); context.lineTo(right, py); context.stroke(); context.setLineDash([]);
    context.fillStyle = color; context.font = "8px system-ui"; context.textAlign = "center"; context.textBaseline = level.type === "EQH" ? "bottom" : "top";
    context.fillText(level.type, (left + right) / 2, py + (level.type === "EQH" ? -3 : 3));
  }
  context.restore();
}

function drawPremiumDiscount(range) {
  if (!layout || !range) return;
  const showPremium = $("#showPremiumZone").checked;
  const showDiscount = $("#showDiscountZone").checked;
  const showEquilibrium = $("#showEquilibrium").checked;
  if (!showPremium && !showDiscount && !showEquilibrium) return;

  const { margin, width, height, step, startIndex, endIndex, min, max, plotHeight } = layout;
  const plotRight = width - margin.right;
  const x = index => margin.left + step * (index - startIndex + 0.5);
  const y = price => margin.top + (max - price) / (max - min) * plotHeight;
  const left = Math.max(margin.left, x(range.fromIndex));
  const right = plotRight;
  if (right <= left || range.confirmedIndex >= endIndex || range.toIndex < startIndex) return;
  const highY = y(range.high), equilibriumY = y(range.equilibrium), lowY = y(range.low);

  context.save();
  context.beginPath(); context.rect(margin.left, margin.top, plotRight - margin.left, height - margin.top - margin.bottom); context.clip();
  context.font = "8px system-ui"; context.textAlign = "left"; context.textBaseline = "top";
  if (showPremium) {
    context.fillStyle = "rgba(255,100,120,.055)";
    context.fillRect(left, highY, right - left, Math.max(1, equilibriumY - highY));
    context.fillStyle = "rgba(255,135,150,.42)";
    context.fillText("PREMIUM", left + 4, highY + 4);
  }
  if (showDiscount) {
    context.fillStyle = "rgba(34,199,141,.055)";
    context.fillRect(left, equilibriumY, right - left, Math.max(1, lowY - equilibriumY));
    context.fillStyle = "rgba(75,220,170,.42)";
    context.fillText("DISCOUNT", left + 4, equilibriumY + 4);
  }
  if (showEquilibrium) {
    context.strokeStyle = "rgba(255,209,102,.48)"; context.lineWidth = 0.8; context.setLineDash([3, 4]);
    context.beginPath(); context.moveTo(left, equilibriumY); context.lineTo(right, equilibriumY); context.stroke(); context.setLineDash([]);
    context.fillStyle = "rgba(255,209,102,.55)";
    context.fillText(`EQ 50% · ${formatPrice(range.equilibrium)}`, left + 4, equilibriumY + 4);
  }
  context.restore();
}

function drawSmc() {
  updateSmcTrend();
  if (!smcLayers) return;
  drawPremiumDiscount(smcLayers.premiumDiscount);
  if ($("#showOrderBlocks").checked) drawSmcZones(smcLayers.orderBlocks, {
    label: "OB", bullishColor: { fill: "rgba(34,199,141,.10)", stroke: "rgba(53,217,160,.48)" }, bearishColor: { fill: "rgba(255,100,120,.10)", stroke: "rgba(255,113,130,.48)" }, limit: 6
  });
  if ($("#showFairValueGaps").checked) drawSmcZones(smcLayers.fairValueGaps, {
    label: "FVG", bullishColor: { fill: "rgba(70,130,255,.09)", stroke: "rgba(96,155,255,.42)" }, bearishColor: { fill: "rgba(255,156,70,.09)", stroke: "rgba(255,174,94,.42)" }, limit: 8
  });
  if ($("#showEqualLevels").checked) drawEqualLevels(smcLayers.equalLevels);
  if ($("#showSwingStructure").checked) drawSmcStructure(smcLayers.swing);
  if ($("#showInternalStructure").checked) drawSmcStructure(smcLayers.internal, { internal: true });
}

function drawCrosshair() {
  if (!crosshair || !layout || yScaleDrag || chartDrag || measurement?.placingEnd) return;
  const { margin, width, height, step, startIndex, min, max, plotHeight, plotWidth } = layout;
  const pointerX = Math.min(width - margin.right, Math.max(margin.left, crosshair.x));
  const pointerY = Math.min(height - margin.bottom, Math.max(margin.top, crosshair.y));
  const slotIndex = Math.min(visibleBarCount - 1, Math.max(0, Math.floor((pointerX - margin.left) / step)));
  const lineX = margin.left + (slotIndex + 0.5) * step;
  const virtualIndex = startIndex + slotIndex;
  const lastCandle = payload.candles.at(-1);
  const candle = payload.candles[virtualIndex];
  const time = candle?.openTime ?? (lastCandle?.openTime + (virtualIndex - payload.candles.length + 1) * timeframeMs());
  const price = max - (pointerY - margin.top) / plotHeight * (max - min);

  context.save();
  context.setLineDash([4, 4]);
  context.strokeStyle = "#8da2b7";
  context.lineWidth = 1;
  context.beginPath(); context.moveTo(lineX, margin.top); context.lineTo(lineX, height - margin.bottom); context.stroke();
  context.beginPath(); context.moveTo(margin.left, pointerY); context.lineTo(width - margin.right, pointerY); context.stroke();
  context.setLineDash([]);

  context.font = "11px system-ui";
  context.textBaseline = "middle";
  const priceText = formatPrice(price);
  context.fillStyle = "#29445f";
  context.fillRect(width - margin.right, pointerY - 10, margin.right, 20);
  context.fillStyle = "#eef6ff";
  context.textAlign = "left";
  context.fillText(priceText, width - margin.right + 6, pointerY);

  if (Number.isFinite(time)) {
    const timeText = formatDate(time).replace(", ", " ");
    const labelWidth = Math.min(plotWidth, context.measureText(timeText).width + 14);
    const labelX = Math.min(width - margin.right - labelWidth, Math.max(margin.left, lineX - labelWidth / 2));
    context.fillStyle = "#29445f";
    context.fillRect(labelX, height - margin.bottom, labelWidth, 22);
    context.fillStyle = "#eef6ff";
    context.textAlign = "center";
    context.fillText(timeText, labelX + labelWidth / 2, height - margin.bottom + 11);
  }
  context.restore();
}

function drawMeasurement() {
  if (!measurement?.start || !measurement?.end || !layout) return;
  const start = measurementPointToCanvas(measurement.start, layout);
  const end = measurementPointToCanvas(measurement.end, layout);
  const stats = measurementStats(measurement.start, measurement.end);
  const color = stats.rising ? "#22c78d" : "#ff6478";
  const left = Math.min(start.x, end.x), top = Math.min(start.y, end.y);
  const boxWidth = Math.abs(end.x - start.x), boxHeight = Math.abs(end.y - start.y);

  context.save();
  context.beginPath();
  context.rect(layout.margin.left, layout.margin.top, layout.plotWidth, layout.plotHeight);
  context.clip();
  context.fillStyle = `${color}24`;
  context.fillRect(left, top, boxWidth, boxHeight);
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.setLineDash([5, 4]);
  context.strokeRect(left, top, boxWidth, boxHeight);
  context.setLineDash([]);
  context.beginPath(); context.arc(start.x, start.y, 3, 0, Math.PI * 2); context.fillStyle = color; context.fill();
  context.beginPath(); context.arc(end.x, end.y, 3, 0, Math.PI * 2); context.fill();
  context.restore();

  const deltaText = `${stats.delta >= 0 ? "+" : ""}${formatPrice(stats.delta)}`;
  const percentText = Number.isFinite(stats.percent) ? `${stats.percent >= 0 ? "+" : ""}${stats.percent.toFixed(2)}%` : "—";
  const barsText = `${stats.bars} nến`;
  context.save();
  context.font = "bold 11px system-ui";
  const labelWidth = Math.max(104, context.measureText(`${deltaText} (${percentText})`).width + 18);
  const labelHeight = 42;
  const preferredX = (start.x + end.x) / 2 - labelWidth / 2;
  const preferredY = stats.rising ? top - labelHeight - 7 : top + boxHeight + 7;
  const labelX = Math.min(layout.width - layout.margin.right - labelWidth, Math.max(layout.margin.left, preferredX));
  const labelY = Math.min(layout.height - layout.margin.bottom - labelHeight, Math.max(layout.margin.top, preferredY));
  context.fillStyle = color;
  context.fillRect(labelX, labelY, labelWidth, labelHeight);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(`${deltaText} (${percentText})`, labelX + labelWidth / 2, labelY + 13);
  context.font = "10px system-ui";
  context.fillText(barsText, labelX + labelWidth / 2, labelY + 29);
  context.restore();
}

function draw() {
  if (!payload) return;
  updateYScaleLabel();
  resizeCanvas();
  const width = canvas.clientWidth, height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);
  const virtualLength = payload.candles.length + futureBarCount;
  const endIndex = Math.max(1, virtualLength - rightOffset);
  const startIndex = Math.max(0, endIndex - visibleBarCount);
  const candleStartIndex = Math.max(0, startIndex);
  const candleEndIndex = Math.min(payload.candles.length, endIndex);
  const candles = payload.candles.slice(candleStartIndex, candleEndIndex);
  if (!candles.length) return;
  const margin = { top: 36, right: 78, bottom: 42, left: 12 };
  const plotWidth = width - margin.left - margin.right, plotHeight = height - margin.top - margin.bottom;
  const rawMin = Math.min(...candles.map(c => c.low)), rawMax = Math.max(...candles.map(c => c.high));
  const pad = Math.max((rawMax - rawMin) * 0.13, rawMax * 0.002);
  const autoMin = rawMin - pad, autoMax = rawMax + pad;
  const autoRange = autoMax - autoMin;
  const center = (autoMin + autoMax) / 2 + autoRange * yCenterOffset;
  const range = Math.max(Number.EPSILON, (autoMax - autoMin) * yScaleFactor);
  const min = center - range / 2, max = center + range / 2;
  const y = value => margin.top + (max - value) / (max - min) * plotHeight;
  const slotCount = Math.max(1, visibleBarCount);
  const firstCandleSlot = candleStartIndex - startIndex;
  const step = plotWidth / slotCount;
  const x = index => margin.left + step * (firstCandleSlot + index + 0.5);

  context.font = "11px system-ui"; context.textAlign = "left"; context.textBaseline = "middle";
  for (let tick = 0; tick <= 5; tick += 1) {
    const value = max - (max - min) * tick / 5, py = y(value);
    context.strokeStyle = "#193149"; context.lineWidth = 1; context.beginPath(); context.moveTo(margin.left, py); context.lineTo(width - margin.right, py); context.stroke();
    context.fillStyle = "#839aaf"; context.fillText(formatPrice(value), width - margin.right + 7, py);
  }

  const bodyWidth = Math.max(1, Math.min(9, step * 0.64));
  candles.forEach((candle, index) => {
    const px = x(index), color = candle.close >= candle.open ? "#22c78d" : "#ff6478";
    context.strokeStyle = color; context.lineWidth = 1; context.beginPath(); context.moveTo(px, y(candle.high)); context.lineTo(px, y(candle.low)); context.stroke();
    const top = y(Math.max(candle.open, candle.close)), bottom = y(Math.min(candle.open, candle.close));
    context.fillStyle = color; context.fillRect(px - bodyWidth / 2, top, bodyWidth, Math.max(1.5, bottom - top));
  });

  layout = { candles, step, margin, width, height, startIndex, endIndex, firstCandleSlot, min, max, plotHeight, plotWidth };
  drawSmc();
  if ($("#showTrendEma").checked) trendEmaLine(candles, x, y);
  if ($("#showSignals").checked) candles.forEach((candle, index) => {
    const buys = candle.buySignalTypes || [], sells = candle.sellSignalTypes || [];
    signalGroup(buys, x(index), y(candle.low), "up", "#22c78d");
    signalGroup(sells, x(index), y(candle.high), "down", "#ff6478");
  });

  const labelEvery = Math.max(1, Math.ceil(candles.length / 7));
  context.fillStyle = "#839aaf"; context.textAlign = "center"; context.textBaseline = "top";
  candles.forEach((candle, index) => { if (index % labelEvery === 0 || index === candles.length - 1) context.fillText(formatDate(candle.openTime).replace(", ", " "), x(index), height - margin.bottom + 9); });
  drawMeasurement();
  drawCrosshair();
}

async function load() {
  const sequence = ++loadSequence;
  const requestedKey = `${exchange}:${symbol}`;
  rightOffset = 0; yScaleFactor = 1; yCenterOffset = 0; measurement = null; crosshair = null;
  $("#chartState").className = "chart-state"; $("#chartState").textContent = "Đang lấy dữ liệu biểu đồ…"; payload = null; layout = null; smcLayers = null; updateSmcTrend();
  document.querySelectorAll("[data-timeframe]").forEach(button => button.classList.toggle("active", button.dataset.timeframe === timeframe));
  try {
    const query = new URLSearchParams({ exchange, symbol, timeframe, limit: "1000" });
    const response = await fetch(`/api/chart/cex?${query}`); const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    if (sequence !== loadSequence) return;
    payload = data; smcLayers = buildSmcLayers(data.candles); $("#chartState").classList.add("hidden");
    exchange = data.market.exchange; symbol = data.market.instrumentId;
    const resolvedItem = { exchange, symbol };
    const requestedIndex = chartItems.findIndex(item => itemKey(item) === requestedKey);
    const resolvedIndex = chartItems.findIndex(item => itemKey(item) === itemKey(resolvedItem));
    if (requestedIndex >= 0 && resolvedIndex < 0) chartItems[requestedIndex] = resolvedItem;
    else if (requestedIndex >= 0 && resolvedIndex !== requestedIndex) chartItems.splice(requestedIndex, 1);
    $("#chartTitle").textContent = `${symbol} · ${timeframe}`;
    const liveBars = data.candles.filter(candle => !candle.isClosed).length;
    $("#chartMeta").textContent = `${exchange} · ${data.candles.length - liveBars} nến đã đóng${liveBars ? " + nến đang chạy" : ""}`;
    history.replaceState(null, "", `/chart.html?${new URLSearchParams({ exchange, symbol, timeframe, returnTab })}`);
    document.title = `${symbol} ${timeframe} · Trading Signal`; saveChartWorkspace(); renderChartList(); draw();
  } catch (error) {
    if (sequence !== loadSequence) return;
    $("#chartState").className = "chart-state chart-error"; $("#chartState").textContent = `Không tải được biểu đồ: ${error.message}`;
    $("#chartTitle").textContent = `${symbol} · ${timeframe}`;
  }
}

canvas.addEventListener("mousemove", event => {
  if (!layout) return;
  const rect = canvas.getBoundingClientRect();
  const overPriceScale = event.clientX - rect.left >= layout.width - layout.margin.right;
  canvas.classList.toggle("scaling-y", overPriceScale || Boolean(yScaleDrag));
  if (yScaleDrag || chartDrag || measurement?.placingEnd) return;
  const x = event.clientX - rect.left, y = event.clientY - rect.top;
  const insidePlot = x >= layout.margin.left && x < layout.width - layout.margin.right && y >= layout.margin.top && y <= layout.height - layout.margin.bottom;
  crosshair = insidePlot ? { x, y } : null;
  draw();
});
canvas.addEventListener("pointerdown", event => {
  if (!layout || (event.pointerType === "mouse" && event.button !== 0)) return;
  if (event.pointerType === "touch") touchPointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
  if (touchPointers.size >= 2) {
    if (!pinchGesture) {
      const entries = [...touchPointers.entries()].slice(0, 2);
      const startDistance = distanceBetweenPointers(entries[0][1], entries[1][1]);
      if (startDistance > 0) {
        const midpoint = midpointBetweenPointers(entries[0][1], entries[1][1]);
        const rect = canvas.getBoundingClientRect();
        pinchGesture = {
          pointerIds: entries.map(([pointerId]) => pointerId),
          startDistance,
          startBarCount: visibleBarCount,
          anchorRatio: plotAnchorRatio(midpoint.clientX, rect.left, layout.margin.left, layout.width - layout.margin.left - layout.margin.right)
        };
        measurement = null; yScaleDrag = null; chartDrag = null; crosshair = null;
        canvas.classList.remove("dragging-chart", "scaling-y", "measuring-chart");
        canvas.classList.add("pinching-chart");
      }
    }
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const pointerX = event.clientX - rect.left, pointerY = event.clientY - rect.top;
  const insidePlot = pointerX >= layout.margin.left && pointerX < layout.width - layout.margin.right && pointerY >= layout.margin.top && pointerY <= layout.height - layout.margin.bottom;
  if (measurement?.placingEnd && insidePlot) {
    const point = measurementPointFromCanvas(pointerX, pointerY, layout);
    measurement = completeMeasurement(measurement, point);
    crosshair = null;
    canvas.classList.remove("measuring-chart");
    event.preventDefault();
    return;
  }
  if (event.shiftKey && insidePlot) {
    const point = measurementPointFromCanvas(pointerX, pointerY, layout);
    measurement = beginMeasurement(point);
    crosshair = null;
    canvas.classList.add("measuring-chart");
  } else if (pointerX >= layout.width - layout.margin.right) {
    yScaleDrag = { startY: event.clientY, startFactor: yScaleFactor };
    canvas.classList.add("scaling-y");
  } else {
    chartDrag = { startX: event.clientX, startY: event.clientY, startOffset: rightOffset, startCenterOffset: yCenterOffset, step: layout.step, plotHeight: canvas.clientHeight - layout.margin.top - layout.margin.bottom };
    canvas.classList.add("dragging-chart");
  }
  crosshair = null;
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});
canvas.addEventListener("pointermove", event => {
  if (event.pointerType === "touch" && touchPointers.has(event.pointerId)) {
    touchPointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
  }
  if (pinchGesture) {
    const [firstId, secondId] = pinchGesture.pointerIds;
    const first = touchPointers.get(firstId), second = touchPointers.get(secondId);
    if (first && second) {
      const distance = distanceBetweenPointers(first, second);
      setVisibleBarCount(pinchBarCount(pinchGesture.startBarCount, pinchGesture.startDistance, distance), pinchGesture.anchorRatio);
    }
  } else if (measurement?.placingEnd) {
    const rect = canvas.getBoundingClientRect();
    measurement = previewMeasurement(measurement, measurementPointFromCanvas(event.clientX - rect.left, event.clientY - rect.top, layout));
    draw();
  } else if (yScaleDrag) {
    const deltaY = event.clientY - yScaleDrag.startY;
    setYScale(yScaleDrag.startFactor * Math.exp(deltaY * 0.01));
  } else if (chartDrag) {
    const movedBars = Math.round((event.clientX - chartDrag.startX) / chartDrag.step);
    const virtualLength = payload.candles.length + futureBarCount;
    rightOffset = clampRightOffset(chartDrag.startOffset + movedBars);
    yCenterOffset = chartDrag.startCenterOffset + (event.clientY - chartDrag.startY) / chartDrag.plotHeight * yScaleFactor;
    draw();
  } else return;
  event.preventDefault();
});
const finishYScaleDrag = event => {
  if (event?.pointerType === "touch") touchPointers.delete(event.pointerId);
  if (pinchGesture && !pinchGesture.pointerIds.includes(event?.pointerId)) {
    if (event?.pointerId != null && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    return;
  }
  if (pinchGesture) pinchGesture = null;
  yScaleDrag = null; chartDrag = null;
  canvas.classList.remove("dragging-chart", "pinching-chart");
  canvas.classList.toggle("measuring-chart", Boolean(measurement?.placingEnd));
  if (event?.pointerId != null && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
};
canvas.addEventListener("pointerup", finishYScaleDrag);
canvas.addEventListener("pointercancel", finishYScaleDrag);
canvas.addEventListener("dblclick", event => {
  if (!layout) return;
  const rect = canvas.getBoundingClientRect();
  if (event.clientX - rect.left >= layout.width - layout.margin.right) resetYScale();
});
canvas.addEventListener("wheel", event => {
  if (!layout) return;
  const rect = canvas.getBoundingClientRect();
  event.preventDefault();
  const plotX = event.clientX - rect.left - layout.margin.left;
  const ratio = Math.min(1, Math.max(0, plotX / (layout.width - layout.margin.left - layout.margin.right)));
  setVisibleBarCount(visibleBarCount * Math.exp(event.deltaY * 0.0015), ratio);
}, { passive: false });
canvas.addEventListener("mouseleave", () => { crosshair = null; draw(); if (!yScaleDrag) canvas.classList.remove("scaling-y"); });
document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || !measurement) return;
  measurement = null;
  canvas.classList.remove("measuring-chart");
  draw();
});
document.querySelectorAll("[data-timeframe]").forEach(button => button.addEventListener("click", () => { timeframe = button.dataset.timeframe; saveChartWorkspace(); load(); }));
for (const selector of ["#showTrendEma", "#showSignals"]) $(selector).addEventListener("change", draw);
for (const id of smcControlIds) $(`#${id}`).addEventListener("change", () => { saveSmcPreferences(); draw(); });
$("#visibleBars").addEventListener("change", event => { visibleBarCount = Number(event.target.value); rightOffset = 0; resetYScale(); });
$("#autoScale").addEventListener("click", resetYScale);
$("#resetView").addEventListener("click", resetView);
new ResizeObserver(draw).observe(canvas);
$("#chartCoinList").addEventListener("click", event => {
  const remove = event.target.closest("[data-remove-key]");
  const row = event.target.closest("[data-select-key]");
  if (remove) {
    event.stopPropagation();
    if (chartItems.length === 1) {
      $("#chartListState").textContent = "Danh sách cần giữ ít nhất coin đang mở.";
      return;
    }
    const key = remove.dataset.removeKey;
    const index = chartItems.findIndex(item => itemKey(item) === key);
    if (index < 0) return;
    const removingSelected = key === `${exchange}:${symbol}`;
    chartItems.splice(index, 1);
    quotesByKey.delete(key);
    if (removingSelected) selectChartItem(chartItems[Math.min(index, chartItems.length - 1)]);
    else { saveChartWorkspace(); renderChartList(); refreshQuotes(); }
    return;
  }
  if (!row || row.dataset.selectKey === `${exchange}:${symbol}`) return;
  const item = chartItems.find(candidate => itemKey(candidate) === row.dataset.selectKey);
  if (item) selectChartItem(item);
});

$("#addChartCoin").addEventListener("submit", async event => {
  event.preventDefault();
  const input = $("#chartCoinInput");
  const value = input.value.trim().toUpperCase();
  if (!value) return;
  if (chartItems.length >= 100) {
    $("#chartListState").textContent = "Danh sách chart đã đạt tối đa 100 coin.";
    return;
  }
  const separator = value.indexOf(":");
  const candidate = separator > 0 ? { exchange: value.slice(0, separator), symbol: value.slice(separator + 1) } : { exchange: "AUTO", symbol: value };
  $("#chartListState").textContent = `Đang kiểm tra ${value}…`;
  try {
    const response = await fetch("/api/market/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: [candidate] }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    const quote = data.quotes[0];
    if (!quote || quote.status === "ERROR") throw new Error(quote?.error || "Không tìm thấy cặp Spot đang giao dịch");
    const item = { exchange: quote.exchange, symbol: quote.instrumentId };
    const existing = chartItems.find(found => itemKey(found) === itemKey(item));
    if (!existing) chartItems.push(item);
    quotesByKey.set(itemKey(item), quote);
    input.value = "";
    $("#chartListState").textContent = existing ? `${quote.instrumentId} đã có trong danh sách.` : `Đã thêm ${quote.instrumentId}.`;
    selectChartItem(existing || item);
    refreshQuotes();
  } catch (error) {
    $("#chartListState").textContent = `Không thêm được ${value}: ${error.message}`;
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshQuotes();
  else clearTimeout(quoteTimer);
});

readSmcPreferences();
readChartWorkspace();
renderChartList();
refreshQuotes({ announce: true });
await load();
