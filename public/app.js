import { parseSymbols } from "./symbols.js";
import { defaultTabForMarket, initialAppTab, marketForTab, normalizeAppTab, shouldRestoreScanCache } from "./navigation-state.js";
import { scanDexTokensSequentially } from "./dex-scan.js";

const $ = selector => document.querySelector(selector);
const h = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const date = timestamp => new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(timestamp);
const price = value => Number.isFinite(value) ? value.toLocaleString("en-US", { maximumSignificantDigits: 10 }) : "—";
const shortAddress = value => value?.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
const signalTypes = row => [...(row.buyTypes ?? []), ...(row.sellTypes ?? []), ...(row.warnings ?? []), ...(row.exitTypes ?? []), ...(row.trendTypes ?? [])];
const chartUrl = (exchange, symbol, timeframe = "1D", returnTab = "cex") => `/chart.html?${new URLSearchParams({ exchange, symbol, timeframe, returnTab: normalizeAppTab(returnTab) })}`;
const dexChartUrl = row => `/chart.html?${new URLSearchParams({ mode: "DEX", network: row.network, tokenAddress: row.tokenAddress, poolAddress: row.poolAddress, symbol: row.instrumentId, timeframe: row.timeframe, returnTab: "dex" })}`;
const metalsChartUrl = (product, side, returnTab = "metals-overview") => `/chart.html?${new URLSearchParams({ mode: "METALS", product, side, timeframe: "1D", returnTab: normalizeAppTab(returnTab) })}`;
const stockChartUrl = (symbol, exchange = "VN", returnTab = "stocks") => `/chart.html?${new URLSearchParams({ mode: "STOCK", exchange, symbol, timeframe: "1D", returnTab: normalizeAppTab(returnTab) })}`;
const scanCacheKeys = { cex: "trading-signal:cex-scan:v1", dex: "trading-signal:dex-scan:v1" };
const chartWorkspaceKey = "trading-signal:chart-workspace:v1";
const activeTabKey = "trading-signal:active-tab:v1";

function saveChartWorkspace(link) {
  const container = link.closest("tbody") || document;
  const items = [...container.querySelectorAll("[data-chart-symbol]")].map(item => ({
    exchange: item.dataset.chartExchange,
    symbol: item.dataset.chartSymbol
  })).filter((item, index, all) => all.findIndex(other => `${other.exchange}:${other.symbol}` === `${item.exchange}:${item.symbol}`) === index);
  if (!items.length) return;
  try {
    localStorage.setItem(chartWorkspaceKey, JSON.stringify({
      selected: `${link.dataset.chartExchange}:${link.dataset.chartSymbol}`,
      timeframe: link.dataset.chartTimeframe || "1D",
      items
    }));
  } catch { /* URL vẫn mở được nếu trình duyệt không cho lưu localStorage. */ }
}

document.addEventListener("click", event => {
  const link = event.target.closest("a[data-chart-symbol]");
  if (link) saveChartWorkspace(link);
});

function saveScanCache(type, value) {
  try { sessionStorage.setItem(scanCacheKeys[type], JSON.stringify(value)); }
  catch { /* A large scan result must not prevent the table from rendering. */ }
}

function readScanCache(type) {
  try { return JSON.parse(sessionStorage.getItem(scanCacheKeys[type]) || "null"); }
  catch { return null; }
}

function readActiveTab() {
  try { return sessionStorage.getItem(activeTabKey); }
  catch { return null; }
}

function activateTab(value, updateUrl = false) {
  const tabName = normalizeAppTab(value);
  const marketName = marketForTab(tabName);
  document.querySelectorAll(".market-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.market === marketName));
  document.querySelectorAll(".subtabs").forEach(nav => {
    const active = nav.dataset.market === marketName;
    nav.classList.toggle("active", active);
    nav.hidden = !active;
  });
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === tabName));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === `panel-${tabName}`));
  try { sessionStorage.setItem(activeTabKey, tabName); } catch { /* URL hash vẫn giữ được tab. */ }
  if (updateUrl) history.replaceState(history.state, "", `${location.pathname}${location.search}#${tabName}`);
}

document.querySelectorAll(".market-tab").forEach(button => button.addEventListener("click", () => activateTab(defaultTabForMarket(button.dataset.market), true)));
document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => activateTab(button.dataset.tab, true)));
activateTab(initialAppTab(location.hash, readActiveTab()), !location.hash);

$("#logout").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  location.replace("/login.html");
});

const config = await fetch("/api/config").then(response => response.json());
$("#symbols").value = config.symbols.join(", ");
const focusTimeframes = config.focus?.timeframes?.length ? config.focus.timeframes : ["4H", "8H"];
const newCoinTimeframe = config.newCoins?.timeframe || "8H";
const dexTimeframes = config.dex?.timeframes?.length ? config.dex.timeframes : ["1H", "4H", "8H", "1D"];
const dexNetworks = config.dex?.networks?.length ? config.dex.networks : ["solana", "eth", "base", "bsc"];
const dexNetworkLabels = config.dex?.networkLabels || {};
const formatClosedCandleTimes = (hours, minute) => hours.map(hour => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`).join(" · ");
function updateClosedCandleSchedulePreview() {
  const value = Number($("#closedCandleMinute").value);
  const minute = Number.isInteger(value) && value >= 0 && value <= 59 ? value : 5;
  const fourHour = config.focus?.scanHours || [3, 7, 11, 15, 19, 23];
  const eightHour = config.newCoins?.scanHours || [7, 15, 23];
  $("#closedCandleSchedulePreview").textContent = `4H: ${formatClosedCandleTimes(fourHour, minute)} · 8H: ${formatClosedCandleTimes(eightHour, minute)} (giờ Việt Nam)`;
}
$("#focusDefaultTimeframe").innerHTML = focusTimeframes.map(value => `<option value="${h(value)}">${h(value)}</option>`).join("");
$("#focusDefaultTimeframe").value = focusTimeframes.includes(config.focus?.defaultTimeframe) ? config.focus.defaultTimeframe : focusTimeframes[0];
document.querySelectorAll(".focus-timeframes-label").forEach(element => { element.textContent = focusTimeframes.join("/"); });
$("#automationTimezone").textContent = config.automation?.timezone || "Asia/Ho_Chi_Minh";
$("#dexTimeframe").innerHTML = dexTimeframes.map(value => `<option value="${h(value)}">${h(value)}</option>`).join("");
$("#dexTimeframe").value = dexTimeframes.includes(config.dex?.defaultTimeframe) ? config.dex.defaultTimeframe : dexTimeframes[0];
$("#dexNetwork").innerHTML = dexNetworks.map(value => `<option value="${h(value)}">${h(dexNetworkLabels[value] || value)}</option>`).join("");
$("#dexMaxTokens").textContent = String(config.dex?.maxTokensPerScan || 10);

const metalOrder = ["VN_GOLD_SJC_BAR", "VN_GOLD_RING_9999", "VN_SILVER_999_KG", "XAU_USD", "XAG_USD", "USD_VND"];
let metalsPayload = null;

function formatMetalPrice(value, currency) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const digits = currency === "VND" ? 0 : number >= 100 ? 2 : 4;
  return `${number.toLocaleString("vi-VN", { maximumFractionDigits: digits })} ${currency || ""}`.trim();
}

function formatMetalUpdated(timestamp) {
  const number = Number(timestamp);
  return Number.isFinite(number) ? new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit",
    day: "2-digit", month: "2-digit", year: "2-digit"
  }).format(number) : "—";
}

function renderMetalsTable(target, market) {
  if (!metalsPayload) return;
  const catalog = metalsPayload.catalog || {};
  const byProduct = new Map((metalsPayload.products || []).map(item => [item.productId, item]));
  const rows = metalOrder.filter(code => market === "ALL" || catalog[code]?.market === market);
  target.innerHTML = rows.map(code => {
    const meta = catalog[code] || {};
    const item = byProduct.get(code);
    if (!item) return `<tr><td><strong>${h(meta.name || code)}</strong><small>${h(code)}</small></td><td colspan="5"><span class="badge error">Chưa có dữ liệu</span></td></tr>`;
    const buy = item.buy;
    const sell = item.sell ?? item.price ?? item.close;
    const spread = Number.isFinite(Number(item.spread)) ? formatMetalPrice(item.spread, meta.currency) : "—";
    const freshness = item.freshness?.status === "FRESH" ? "Mới" : "Cũ";
    const freshnessClass = item.freshness?.status === "FRESH" ? "running" : "paused";
    const returnTab = market === "VIETNAM" ? "metals-vietnam" : market === "WORLD" ? "metals-world" : "metals-overview";
    const charts = meta.market === "WORLD"
      ? `<a class="chart-link" href="${h(metalsChartUrl(code, "MID", returnTab))}">Mở D1</a>`
      : `<a class="chart-link" href="${h(metalsChartUrl(code, "BUY", returnTab))}">Mua</a><span class="metal-chart-separator">·</span><a class="chart-link" href="${h(metalsChartUrl(code, "SELL", returnTab))}">Bán</a>`;
    return `<tr><td><strong>${h(meta.name || code)}</strong><small>${h(code)} · ${h(meta.unit || item.unit || "")}</small></td><td>${h(formatMetalPrice(buy, meta.currency))}</td><td><strong>${h(formatMetalPrice(sell, meta.currency))}</strong></td><td>${h(spread)}</td><td>${h(item.provider || "—")}<small>${h(formatMetalUpdated(item.sourceUpdatedAt))} · <span class="badge ${freshnessClass}">${freshness}</span></small></td><td>${charts}</td></tr>`;
  }).join("");
}

function comparisonTone(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) < 0.000001) return "neutral";
  return number > 0 ? "premium" : "discount";
}

function formatComparison(side) {
  if (!side || !Number.isFinite(Number(side.difference)) || !Number.isFinite(Number(side.percent))) return "—";
  const difference = Number(side.difference);
  const percent = Number(side.percent);
  const sign = difference > 0 ? "+" : "";
  const percentSign = percent > 0 ? "+" : "";
  const label = difference > 0 ? "Premium" : difference < 0 ? "Discount" : "Ngang giá";
  return `<span class="metal-comparison-value ${comparisonTone(difference)}">${h(`${sign}${Math.round(difference).toLocaleString("vi-VN")} ₫`)}<small>${h(`${label} · ${percentSign}${percent.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`)}</small></span>`;
}

function renderMetalComparison() {
  const comparison = metalsPayload?.comparison;
  const state = document.querySelector("[data-metals-comparison-state]");
  const target = document.querySelector("[data-metals-comparison-results]");
  if (!state || !target) return;
  if (!comparison || comparison.error) {
    state.textContent = comparison?.error || "Chưa có dữ liệu quy đổi.";
    target.innerHTML = '<tr><td colspan="7">Không đủ dữ liệu XAU/USD, XAG/USD và USD/VND để so sánh.</td></tr>';
    return;
  }

  const benchmarkValues = {
    xauUsd: formatMetalPrice(comparison.inputs.xauUsd, "USD"),
    xagUsd: formatMetalPrice(comparison.inputs.xagUsd, "USD"),
    usdVnd: formatMetalPrice(comparison.inputs.usdVnd, "VND"),
    goldVndPerLuong: formatMetalPrice(comparison.benchmarks.goldVndPerLuong, "VND"),
    silverVndPerKg: formatMetalPrice(comparison.benchmarks.silverVndPerKg, "VND")
  };
  document.querySelectorAll("[data-metal-benchmark]").forEach(element => {
    element.textContent = benchmarkValues[element.dataset.metalBenchmark] || "—";
  });

  const catalog = metalsPayload.catalog || {};
  target.innerHTML = comparison.rows.map(row => {
    const meta = catalog[row.productId] || {};
    if (row.missing) return `<tr><td><strong>${h(meta.name || row.productId)}</strong><small>${h(row.productId)}</small></td><td colspan="6"><span class="badge error">Chưa có dữ liệu</span></td></tr>`;
    return `<tr><td><strong>${h(meta.name || row.productId)}</strong><small>${h(row.productId)} · ${h(meta.unit || "")}</small></td><td>${h(formatMetalPrice(row.buy?.price, "VND"))}</td><td>${formatComparison(row.buy)}</td><td><strong>${h(formatMetalPrice(row.sell?.price, "VND"))}</strong></td><td>${formatComparison(row.sell)}</td><td><strong>${h(formatMetalPrice(row.benchmark, "VND"))}</strong><small>${h(row.referenceProductId)}</small></td><td>${h(row.provider || "—")}<small>${h(formatMetalUpdated(row.sourceUpdatedAt))}</small></td></tr>`;
  }).join("");
  state.textContent = `Đã quy đổi theo dữ liệu mới nhất · ${formatMetalUpdated(comparison.generatedAt)}`;
}

function renderMetals() {
  document.querySelectorAll("[data-metals-results]").forEach(target => renderMetalsTable(target, target.dataset.metalsResults));
  document.querySelectorAll("[data-metals-state]").forEach(target => {
    target.textContent = `Đã đọc ${metalOrder.length} sản phẩm · ${formatMetalUpdated(metalsPayload.generatedAt)}`;
  });
  renderMetalComparison();
}

async function loadMetals() {
  const buttons = [...document.querySelectorAll(".reload-metals")];
  buttons.forEach(button => { button.disabled = true; });
  document.querySelectorAll("[data-metals-state]").forEach(target => { target.textContent = "Đang đọc Metals Data Collector…"; });
  try {
    const response = await fetch("/api/metals/latest");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    metalsPayload = data;
    renderMetals();
  } catch (error) {
    document.querySelectorAll("[data-metals-state]").forEach(target => { target.textContent = `Lỗi: ${error.message}`; });
    document.querySelectorAll("[data-metals-results]").forEach(target => { target.innerHTML = '<tr><td colspan="6">Không tải được dữ liệu Vàng &amp; Bạc.</td></tr>'; });
    const comparisonState = document.querySelector("[data-metals-comparison-state]");
    const comparisonTarget = document.querySelector("[data-metals-comparison-results]");
    if (comparisonState) comparisonState.textContent = `Lỗi: ${error.message}`;
    if (comparisonTarget) comparisonTarget.innerHTML = '<tr><td colspan="7">Không tải được dữ liệu so sánh.</td></tr>';
  } finally { buttons.forEach(button => { button.disabled = false; }); }
}

document.querySelectorAll(".reload-metals").forEach(button => button.addEventListener("click", loadMetals));
document.querySelector('[data-market="metals"]').addEventListener("click", () => { if (!metalsPayload) loadMetals(); });
document.querySelectorAll('[data-tab^="metals-"]').forEach(button => button.addEventListener("click", () => { if (!metalsPayload) loadMetals(); }));
if (marketForTab(initialAppTab(location.hash, readActiveTab())) === "metals") loadMetals();

let stocksPayload = null;
let stockWatchlist = new Set();
let stockScanResults = new Map();
let stockGroups = new Map();

function formatStockChange(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '<span class="stock-change neutral">—</span>';
  const tone = number < 0 ? "down" : number > 0 ? "up" : "neutral";
  const sign = number > 0 ? "+" : "";
  return `<span class="stock-change ${tone}">${h(`${sign}${number.toFixed(2)}%`)}</span>`;
}

function formatStockDate(value) {
  if (!value) return "—";
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return h(value);
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(timestamp);
}

function stockSignalCell(symbol) {
  const row = stockScanResults.get(symbol);
  if (!row) return { badge: '<span class="badge none">—</span>', detail: "—" };
  const detail = row.error || signalTypes(row).join(", ") || "—";
  return { badge: `<span class="badge ${h(String(row.status).toLowerCase())}">${h(row.status)}</span>`, detail: h(detail) };
}

function selectedStockSymbols() {
  return [...document.querySelectorAll('[data-stock-watch]:checked')].map(input => input.dataset.stockWatch);
}

function displayedStockRows(data) {
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const view = $("#stockListView")?.value || "WATCHLIST";
  return view === "ALL" ? rows : rows.filter(row => stockWatchlist.has(row.symbol));
}

function renderStocks(data) {
  const allRows = Array.isArray(data?.rows) ? data.rows : [];
  const rows = displayedStockRows(data);
  const view = $("#stockListView")?.value || "WATCHLIST";
  $("#stockCount").textContent = view === "ALL" ? `${rows.length} mã` : `${rows.length} watch`;
  $("#stockResults").innerHTML = rows.length ? rows.map(row => {
    const chartHref = stockChartUrl(row.symbol, row.exchange, "stocks");
    const latest = row.close == null ? Number.NaN : Number(row.close);
    const signal = stockSignalCell(row.symbol);
    const checked = stockWatchlist.has(row.symbol) ? " checked" : "";
    return `<tr><td><input type="checkbox" data-stock-watch="${h(row.symbol)}"${checked}></td><td><a class="chart-link" href="${h(chartHref)}"><strong>${h(row.symbol)}</strong></a></td><td><span class="exchange">${h(row.exchange)}</span></td><td>${h(row.name || row.symbol)}</td><td><strong>${h(price(latest))}</strong><small>nghìn VND · ${h(row.provider || "database")}</small></td><td>${formatStockChange(row.changePercent)}</td><td>${signal.badge}</td><td>${signal.detail}</td><td>${h(formatStockDate(row.openTime))}</td><td><a class="chart-link" href="${h(chartHref)}">Mở D1</a></td><td><button type="button" class="secondary compact" data-stock-remove="${h(row.symbol)}">Xóa</button></td></tr>`;
  }).join("") : `<tr><td colspan="11">${view === "WATCHLIST" ? "Watchlist đang trống. Chọn ‘Tất cả mã đã chuẩn bị’ để xem universe trong PostgreSQL." : "Chưa có dữ liệu chứng khoán."}</td></tr>`;
}

function renderStockGroups() {
  const target = $("#stockGroupState");
  const select = $("#stockScanScope");
  if (!target || !select) return;
  [...select.options].forEach(option => {
    if (option.value === "WATCHLIST") { option.textContent = `Watchlist (${stockWatchlist.size})`; return; }
    const row = stockGroups.get(option.value);
    option.textContent = row ? `${option.value} (${row.preparedCount}/${row.total} sẵn sàng)` : option.value;
  });
  const scope = select.value;
  if (scope === "WATCHLIST") { target.textContent = `Watchlist: ${stockWatchlist.size} mã sẽ được quét.`; return; }
  const row = stockGroups.get(scope);
  target.textContent = row ? `${scope}: ${row.preparedCount}/${row.total} mã đã có dữ liệu · ${row.missingCount} mã chưa chuẩn bị.` : "Chưa tải thông tin nhóm quét.";
}

async function loadStocks() {
  const button = $("#reloadStocks");
  button.disabled = true;
  $("#stockState").textContent = "Đang đọc dữ liệu từ PostgreSQL…";
  try {
    const [overviewResponse, watchResponse, groupsResponse] = await Promise.all([fetch("/api/stocks/overview"), fetch("/api/stocks/watchlist"), fetch("/api/stocks/groups")]);
    const data = await overviewResponse.json();
    const watch = await watchResponse.json();
    const groupsPayload = await groupsResponse.json();
    if (!overviewResponse.ok) throw new Error(data.error || `HTTP ${overviewResponse.status}`);
    if (!watchResponse.ok) throw new Error(watch.error || `HTTP ${watchResponse.status}`);
    if (!groupsResponse.ok) throw new Error(groupsPayload.error || `HTTP ${groupsResponse.status}`);
    stocksPayload = data;
    stockWatchlist = new Set(watch.symbols || []);
    stockGroups = new Map((groupsPayload.groups || []).map(row => [row.group, row]));
    renderStocks(data);
    renderStockGroups();
    const viewLabel = ($("#stockListView")?.value || "WATCHLIST") === "ALL" ? "tất cả mã đã chuẩn bị" : "watchlist";
    $("#stockState").textContent = `Đã đọc ${data.rows?.length || 0} mã · watchlist ${stockWatchlist.size} mã · đang hiển thị ${viewLabel}.`;
  } catch (error) {
    $("#stockCount").textContent = "0 mã";
    $("#stockState").textContent = `Lỗi: ${error.message}`;
    $("#stockResults").innerHTML = '<tr><td colspan="11">Không tải được dữ liệu Chứng khoán Việt Nam.</td></tr>';
  } finally { button.disabled = false; }
}

$("#addStock").addEventListener("click", async () => {
  const button = $("#addStock");
  const input = $("#addStockSymbol");
  const raw = String(input.value || "").trim();
  if (!raw) { $("#stockState").textContent = "Nhập một hoặc nhiều mã chứng khoán cần thêm."; return; }
  const estimated = [...new Set(raw.toUpperCase().split(/[\s,;]+/).filter(Boolean))];
  button.disabled = true;
  $("#stockState").textContent = `Đang xử lý ${estimated.length} mã · tự bỏ qua mã đã có…`;
  try {
    const response = await fetch("/api/stocks/instruments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symbols: raw, years: 3 }) });
    const data = await response.json();
    if (!response.ok && response.status !== 207) throw new Error(data.error || `HTTP ${response.status}`);
    if (data.added?.length || data.prepared?.length || data.retried?.length || data.skipped?.length) {
      input.value = "";
      stocksPayload = null;
      await loadStocks();
    }
    const added = data.added?.length || 0;
    const prepared = data.prepared?.length ?? data.skipped?.length ?? 0;
    const retried = data.retried?.length || 0;
    const failed = data.failed?.length || 0;
    const failedText = failed ? ` · lỗi ${failed}: ${data.failed.map(item => item.symbol).join(", ")}` : "";
    $("#stockState").textContent = `Xong ${data.requested || estimated.length} mã · thêm mới ${added} · đã chuẩn bị ${prepared} · backfill lại ${retried}${failedText}.`;
  } catch (error) { $("#stockState").textContent = `Lỗi thêm danh sách: ${error.message}`; }
  finally { button.disabled = false; }
});

$("#addStockSymbol").addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") $("#addStock").click(); });

$("#stockResults").addEventListener("click", async event => {
  const button = event.target.closest("[data-stock-remove]");
  if (!button) return;
  const symbol = button.dataset.stockRemove;
  if (!confirm(`Xóa ${symbol} khỏi danh sách theo dõi? Dữ liệu lịch sử vẫn được giữ trong database.`)) return;
  button.disabled = true;
  $("#stockState").textContent = `Đang xóa ${symbol}…`;
  try {
    const response = await fetch(`/api/stocks/instruments?symbol=${encodeURIComponent(symbol)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    stockWatchlist.delete(symbol);
    stockScanResults.delete(symbol);
    stocksPayload = null;
    await loadStocks();
    $("#stockState").textContent = `Đã xóa ${symbol}; dữ liệu lịch sử được giữ lại.`;
  } catch (error) { $("#stockState").textContent = `Lỗi xóa mã: ${error.message}`; button.disabled = false; }
});

$("#reloadStocks").addEventListener("click", loadStocks);
$("#saveStockWatchlist").addEventListener("click", async () => {
  const button = $("#saveStockWatchlist");
  button.disabled = true;
  try {
    const symbols = selectedStockSymbols();
    const response = await fetch("/api/stocks/watchlist", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ symbols }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    stockWatchlist = new Set(data.symbols || []);
    automationSnapshot.settings.assets.stocks.watchlist = [...stockWatchlist];
    if ($("#autoStockSymbols")) $("#autoStockSymbols").value = [...stockWatchlist].join(", ");
    renderStockGroups();
    renderStocks(stocksPayload);
    $("#stockState").textContent = `Đã lưu watchlist ${stockWatchlist.size} mã.`;
  } catch (error) { $("#stockState").textContent = `Lỗi lưu watchlist: ${error.message}`; }
  finally { button.disabled = false; }
});

$("#scanStocks").addEventListener("click", async () => {
  const button = $("#scanStocks");
  const scope = $("#stockScanScope").value;
  const symbols = scope === "WATCHLIST" ? selectedStockSymbols() : [];
  if (scope === "WATCHLIST" && !symbols.length) { $("#stockState").textContent = "Hãy chọn ít nhất 1 mã để quét D1."; return; }
  const group = stockGroups.get(scope);
  if (scope !== "WATCHLIST" && (!group || !group.preparedCount)) { $("#stockState").textContent = `Nhóm ${scope} chưa có mã nào được chuẩn bị dữ liệu.`; return; }
  const count = scope === "WATCHLIST" ? symbols.length : group.preparedCount;
  button.disabled = true; $("#stockState").textContent = `Đang quét D1 ${scope} · ${count} mã…`; $("#stockSummary").innerHTML = "";
  try {
    const response = await fetch("/api/scan/stocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope, symbols }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    stockScanResults = new Map(data.results.map(row => [row.symbol, row]));
    renderSummary($("#stockSummary"), data.results);
    renderStocks(stocksPayload);
    $("#stockState").textContent = `Đã quét ${data.results.length} mã D1 · ${data.scope?.scope || scope} · ${new Date(data.generatedAt).toLocaleTimeString("vi-VN")}`;
  } catch (error) { $("#stockState").textContent = `Lỗi quét Stock: ${error.message}`; }
  finally { button.disabled = false; }
});

$("#stockListView").addEventListener("change", () => {
  renderStocks(stocksPayload);
  const view = $("#stockListView").value;
  $("#stockState").textContent = view === "ALL" ? `Đang hiển thị tất cả ${stocksPayload?.rows?.length || 0} mã đã chuẩn bị.` : `Đang hiển thị watchlist ${stockWatchlist.size} mã.`;
});
$("#stockScanScope").addEventListener("change", renderStockGroups);
document.querySelector('[data-market="stocks"]').addEventListener("click", () => { if (!stocksPayload) loadStocks(); });
if (marketForTab(initialAppTab(location.hash, readActiveTab())) === "stocks") loadStocks();

let automationSnapshot = await fetch("/api/automation").then(response => response.json());

async function importTextFile(input, state, onLoaded) {
  const file = input.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".txt") || file.size > 1024 * 1024) {
    state.textContent = "File phải có định dạng .txt và không vượt quá 1 MB.";
    input.value = "";
    return;
  }
  try { onLoaded(await file.text(), file.name); }
  catch (error) { state.textContent = `Không đọc được file: ${error.message}`; }
}

$("#stockSymbolFile").addEventListener("change", () => importTextFile($("#stockSymbolFile"), $("#stockState"), (text, name) => {
  const symbols = [...new Set(String(text).toUpperCase().split(/[\s,;]+/).map(value => value.trim()).filter(Boolean))];
  if (!symbols.length) throw new Error("Không tìm thấy mã Stock hợp lệ");
  if (symbols.length > 100) throw new Error("Mỗi lần chỉ hỗ trợ tối đa 100 mã Stock");
  $("#addStockSymbol").value = symbols.join(" ");
  $("#stockState").textContent = `Đã nạp ${symbols.length} mã Stock từ ${name}. Kiểm tra danh sách rồi bấm Thêm danh sách + backfill.`;
}));

$("#watchlistFile").addEventListener("change", () => importTextFile($("#watchlistFile"), $("#fileState"), (text, name) => {
  const imported = parseSymbols(text);
  if (!imported.length) throw new Error("Không tìm thấy ticker hợp lệ");
  $("#symbols").value = imported.join(", ");
  $("#fileState").textContent = `Đã nhập ${imported.length} coin từ ${name}; vẫn có thể sửa trong ô bên dưới.`;
}));

$("#dexFile").addEventListener("change", () => importTextFile($("#dexFile"), $("#dexFileState"), (text, name) => {
  const imported = parseDexTokens(text);
  if (!imported.length) throw new Error("Không tìm thấy chain:token_address hợp lệ");
  $("#dexTokens").value = imported.map(item => `${item.network}:${item.tokenAddress}${item.poolAddress ? `:${item.poolAddress}` : ""}`).join("\n");
  $("#dexFileState").textContent = `Đã nhập ${imported.length} token address từ ${name}.`;
}));

function parseDexTokens(text) {
  const found = new Map();
  for (const raw of text.split(/[\r\n,;]+/)) {
    const line = raw.trim();
    if (!line || line.startsWith("###")) continue;
    const [networkRaw, tokenRaw, poolRaw = ""] = line.split(":");
    const network = String(networkRaw || "").trim().toLowerCase();
    const tokenAddress = String(tokenRaw || "").trim();
    const poolAddress = String(poolRaw || "").trim();
    if (!network || !tokenAddress) throw new Error(`Dòng không hợp lệ: ${line}`);
    found.set(`${network}:${tokenAddress}`, { network, tokenAddress, ...(poolAddress ? { poolAddress } : {}) });
  }
  return [...found.values()];
}

const dexTokenLine = item => `${item.network}:${item.tokenAddress}${item.poolAddress ? `:${item.poolAddress}` : ""}`;
let discoveredDexPools = [];

function selectedDexPoolText(pool) {
  const liquidity = Number(pool.liquidityUsd || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const volume = Number(pool.volume24hUsd || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const minimum = Number(config.dex?.minimumLiquidityUsd || 10_000).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const warning = pool.meetsMinimumLiquidity ? "" : ` · dưới ngưỡng $${minimum}`;
  return `${pool.poolName || pool.quoteSymbol} · ${pool.dex} · TVL $${liquidity} · Vol24h $${volume}${warning}`;
}

function updateDexPoolState() {
  const pool = discoveredDexPools.find(item => item.poolAddress === $("#dexPoolSelect").value);
  if (!pool) return;
  $("#dexPoolState").textContent = `${selectedDexPoolText(pool)} · ${shortAddress(pool.poolAddress)}`;
}

$("#findDexPools").addEventListener("click", async () => {
  const button = $("#findDexPools");
  const network = $("#dexNetwork").value;
  const tokenAddress = $("#dexTokenAddress").value.trim();
  button.disabled = true;
  $("#dexPoolPicker").classList.add("hidden");
  $("#dexPoolState").textContent = "Đang lấy danh sách pool…";
  try {
    const response = await fetch(`/api/dex/pools?${new URLSearchParams({ network, tokenAddress })}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    discoveredDexPools = data.pools || [];
    if (!discoveredDexPools.length) throw new Error("Không tìm thấy pool nào cho contract này trên chain đã chọn");
    $("#dexPoolSelect").innerHTML = discoveredDexPools.map(pool => `<option value="${h(pool.poolAddress)}">${h(selectedDexPoolText(pool))}</option>`).join("");
    $("#dexPoolPicker").classList.remove("hidden");
    updateDexPoolState();
  } catch (error) {
    discoveredDexPools = [];
    $("#dexPoolState").textContent = `Lỗi: ${error.message}`;
  } finally { button.disabled = false; }
});

$("#dexPoolSelect").addEventListener("change", updateDexPoolState);

$("#addDexToken").addEventListener("click", () => {
  const pool = discoveredDexPools.find(item => item.poolAddress === $("#dexPoolSelect").value);
  if (!pool) return;
  const item = { network: $("#dexNetwork").value, tokenAddress: $("#dexTokenAddress").value.trim(), poolAddress: pool.poolAddress };
  const tokens = parseDexTokens($("#dexTokens").value);
  const index = tokens.findIndex(found => found.network === item.network && found.tokenAddress.toLowerCase() === item.tokenAddress.toLowerCase());
  if (index >= 0) tokens[index] = item;
  else tokens.push(item);
  $("#dexTokens").value = tokens.map(dexTokenLine).join("\n");
  $("#dexPoolState").textContent = `Đã thêm ${dexNetworkLabels[item.network] || item.network} · ${shortAddress(item.tokenAddress)} · pool ${shortAddress(item.poolAddress)}.`;
});

function renderSummary(target, rows) {
  const counts = rows.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] ?? 0) + 1 }), {});
  target.innerHTML = ["BUY", "SELL", "BOTH", "NONE", "SKIPPED", "ERROR"].filter(key => counts[key]).map(key => `<div class="card ${key.toLowerCase()}"><b>${counts[key]}</b><span>${key}</span></div>`).join("");
}

const order = { BOTH: 0, BUY: 1, SELL: 2, NONE: 3, SKIPPED: 4, ERROR: 5 };
let lastCexResults = [];
let lastDexResults = [];

function renderCexResults(data, restored = false) {
  renderSummary($("#summary"), data.results);
  lastCexResults = [...data.results].sort((a, b) => order[a.status] - order[b.status]);
  $("#results").innerHTML = lastCexResults.map((row, index) => {
    const focusButtons = data.timeframe === "1D" && ["BUY", "SELL", "BOTH"].includes(row.status) ? `${row.buySignalTypes?.length ? `<button class="focus-action" data-focus-index="${index}" data-direction="BUY">+ BUY</button>` : ""}${row.sellSignalTypes?.length ? `<button class="focus-action sell-action" data-focus-index="${index}" data-direction="SELL">+ SELL</button>` : ""}` : "—";
    const symbol = row.instrumentId || row.requestedSymbol;
    const chart = row.status !== "ERROR" && row.status !== "SKIPPED" ? `<a class="chart-link" data-chart-exchange="${h(row.exchange)}" data-chart-symbol="${h(symbol)}" data-chart-timeframe="${h(data.timeframe)}" href="${h(chartUrl(row.exchange, symbol, data.timeframe, "cex"))}">${h(symbol)}</a>` : `<strong>${h(symbol)}</strong>`;
    return `<tr><td>${chart}</td><td><span class="exchange ${h(String(row.exchange).toLowerCase())}">${h(row.exchange)}</span></td><td>${h(row.timeframe || data.timeframe)}</td><td><span class="badge ${h(row.status.toLowerCase())}">${h(row.status)}</span></td><td>${h(row.error || signalTypes(row).join(", ") || "—")}</td><td>${price(row.close)}</td><td>${row.candleOpenTime ? date(row.candleOpenTime) : "—"}</td><td class="row-actions">${focusButtons}</td></tr>`;
  }).join("");
  $("#state").textContent = `${restored ? "Kết quả gần nhất" : "Đã quét"} ${data.results.length} cặp · ${new Date(data.generatedAt).toLocaleTimeString("vi-VN")}`;
}

$("#scan").addEventListener("click", async () => {
  const button = $("#scan");
  button.disabled = true; $("#state").textContent = "Đang lấy dữ liệu và tính tín hiệu…"; $("#results").innerHTML = ""; $("#summary").innerHTML = "";
  try {
    const response = await fetch("/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symbols: parseSymbols($("#symbols").value), timeframe: $("#cexTimeframe").value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    renderCexResults(data);
    saveScanCache("cex", { data, symbols: $("#symbols").value, timeframe: $("#cexTimeframe").value });
  } catch (error) { $("#state").textContent = `Lỗi: ${error.message}`; }
  finally { button.disabled = false; }
});

$("#results").addEventListener("click", async event => {
  const button = event.target.closest("[data-focus-index]");
  if (!button) return;
  const row = lastCexResults[Number(button.dataset.focusIndex)];
  button.disabled = true;
  try {
    await api("/api/focus", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset: row.asset, exchange: row.exchange, instrumentId: row.instrumentId, direction: button.dataset.direction, timeframe: $("#focusDefaultTimeframe").value }) });
    button.textContent = "Đã thêm";
    await loadFocusList();
  } catch (error) { button.textContent = `Lỗi: ${error.message}`; button.disabled = false; }
});

function renderDexResults(data, restored = false) {
  renderSummary($("#dexSummary"), data.results);
  lastDexResults = [...data.results].sort((a, b) => order[a.status] - order[b.status]);
  $("#dexResults").innerHTML = lastDexResults.map((row, index) => {
    const types = row.error || signalTypes(row).join(", ") || "—";
    const warning = row.poolWarnings?.length ? `<small class="pool-warning">${h(row.poolWarnings.join(" · "))}</small>` : "";
    const pin = row.poolPinned ? "Pool ghim" : "Tự chọn";
    const pinButton = row.poolAddress ? `<button type="button" class="secondary dex-pin-action" data-dex-pin="${index}"${row.poolPinned ? " disabled" : ""}>${row.poolPinned ? "Đã ghim" : "Ghim pool"}</button>` : "";
    const pool = row.poolName ? `${h(row.poolName)} · ${h(row.quoteSymbol)} · $${h(Number(row.liquidityUsd).toLocaleString("en-US", { maximumFractionDigits: 0 }))}<small title="${h(row.poolAddress)}">${pin} · ${h(shortAddress(row.poolAddress))}</small>${warning}${pinButton}` : h(row.error || "—");
    const token = row.status === "ERROR" ? `<strong>${h(row.instrumentId)}</strong>` : `<a class="chart-link" href="${h(dexChartUrl(row))}">${h(row.instrumentId)}</a>`;
    return `<tr title="${h(row.tokenAddress)}"><td>${token}<small class="address">${h(shortAddress(row.tokenAddress))}</small></td><td>${h(row.network)}<small>${h(row.dex || "—")}</small></td><td>${h(row.timeframe || data.timeframe)}</td><td><span class="badge ${h(row.status.toLowerCase())}">${h(row.status)}</span></td><td>${h(types)}</td><td>${pool}</td><td>${row.candleOpenTime ? date(row.candleOpenTime) : "—"}</td></tr>`;
  }).join("");
  $("#dexState").textContent = `${restored ? "Kết quả gần nhất" : "Đã quét"} ${data.results.length} token · ${new Date(data.generatedAt).toLocaleTimeString("vi-VN")}`;
}

$("#dexResults").addEventListener("click", event => {
  const button = event.target.closest("[data-dex-pin]");
  if (!button) return;
  const row = lastDexResults[Number(button.dataset.dexPin)];
  if (!row?.poolAddress) return;
  const tokens = parseDexTokens($("#dexTokens").value).map(item => item.network === row.network && item.tokenAddress === row.tokenAddress ? { ...item, poolAddress: row.poolAddress } : item);
  $("#dexTokens").value = tokens.map(item => `${item.network}:${item.tokenAddress}${item.poolAddress ? `:${item.poolAddress}` : ""}`).join("\n");
  button.textContent = "Đã ghim";
  button.disabled = true;
  $("#dexState").textContent = `Đã ghim pool ${shortAddress(row.poolAddress)}; bấm Quét DEX để xác nhận lại.`;
});

$("#scanDex").addEventListener("click", async () => {
  const button = $("#scanDex");
  button.disabled = true; $("#dexState").textContent = "Đang tìm pool và lấy nến; vui lòng chờ…"; $("#dexResults").innerHTML = ""; $("#dexSummary").innerHTML = "";
  try {
    const tokens = parseDexTokens($("#dexTokens").value);
    const timeframe = $("#dexTimeframe").value;
    const data = await scanDexTokensSequentially(tokens, timeframe, async token => {
      const response = await fetch("/api/scan/dex", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokens: [token], timeframe }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      return payload;
    }, progress => {
      $("#dexState").textContent = progress.completed < progress.total
        ? `Đang quét token ${progress.completed + 1}/${progress.total}…`
        : `Đã tải dữ liệu ${progress.completed}/${progress.total} token…`;
    });
    renderDexResults(data);
    saveScanCache("dex", { data, tokens: $("#dexTokens").value, timeframe });
  } catch (error) { $("#dexState").textContent = `Lỗi: ${error.message}`; }
  finally { button.disabled = false; }
});

const navigationType = performance.getEntriesByType?.("navigation")?.[0]?.type || (performance.navigation?.type === 1 ? "reload" : "navigate");
if (!shouldRestoreScanCache(navigationType)) {
  try { Object.values(scanCacheKeys).forEach(key => sessionStorage.removeItem(key)); } catch { /* Không có sessionStorage thì không có cache cần xóa. */ }
}

const cachedCex = shouldRestoreScanCache(navigationType) ? readScanCache("cex") : null;
if (cachedCex?.data?.results?.length) {
  $("#symbols").value = cachedCex.symbols || $("#symbols").value;
  $("#cexTimeframe").value = cachedCex.timeframe || cachedCex.data.timeframe || "1D";
  renderCexResults(cachedCex.data, true);
}
const cachedDex = shouldRestoreScanCache(navigationType) ? readScanCache("dex") : null;
if (cachedDex?.data?.results?.length) {
  $("#dexTokens").value = cachedDex.tokens || "";
  $("#dexTimeframe").value = dexTimeframes.includes(cachedDex.timeframe || cachedDex.data.timeframe) ? (cachedDex.timeframe || cachedDex.data.timeframe) : (config.dex?.defaultTimeframe || "4H");
  renderDexResults(cachedDex.data, true);
}

function stockRunDetail(run) {
  if (!run) return { text: "Stock D1: chưa chạy trong phiên này.", className: "" };
  if (run.status === "RUNNING") return { text: "Stock D1: đang chạy Daily Sync → quét D1…", className: "running" };
  if (run.status === "SKIPPED") return { text: `Stock D1: bỏ qua · ${run.reason || "không có dữ liệu để quét"}.`, className: "skipped" };
  if (run.status === "ERROR") return { text: `Stock D1: lỗi tại ${run.stage || "không xác định"} · ${run.errors || 1} lỗi.`, className: "error" };
  return { text: `Stock D1: hoàn tất · sync ${run.synced || 0} mã · quét ${run.total || 0} mã · ${run.sentSignals || 0} tín hiệu mới · ${run.errors || 0} lỗi.`, className: "ok" };
}

function renderStockAutomationRuntime(lastRuns = {}) {
  const element = $("#stockAutomationRuntime");
  if (!element) return;
  const detail = stockRunDetail(lastRuns["stocks:1D"]);
  element.textContent = detail.text;
  element.className = `stock-runtime ${detail.className}`.trim();
}

function renderLastRuns(lastRuns = {}) {
  const rows = ["crypto:1D", "crypto:1W", "metals:1D", "stocks:1D", "dex:4H", "dex:8H", "focus", "newCoins"].map(key => [key, lastRuns[key] ?? lastRuns[key.slice(7)]]).filter(([, run]) => run).map(([key, run]) => {
    const timeframe = key === "focus" ? `Theo dõi ${focusTimeframes.join("/")}` : key === "newCoins" ? `Coin mới ${newCoinTimeframe}` : key === "metals:1D" ? "Vàng–Bạc SELL D1" : key === "stocks:1D" ? "Stock D1" : key.startsWith("dex:") ? `DEX ${run.timeframe || key.slice(4)}` : (run.timeframe || key.slice(7));
    let detail;
    if (run.status === "RUNNING") detail = "Đang chạy…";
    else if (run.status === "SKIPPED") detail = `Bỏ qua: ${run.reason || "không có dữ liệu mới"}`;
    else if (run.status === "ERROR") detail = `Lỗi: ${run.errors || 1}${run.stage ? ` · ${run.stage}` : ""}`;
    else detail = `${run.total || 0} mã · ${run.sentSignals || 0} tín hiệu mới · ${run.errors || 0} lỗi`;
    return `<div><b>${timeframe}</b> · ${h(new Date(run.at).toLocaleString("vi-VN"))} · ${h(detail)}</div>`;
  });
  $("#lastRuns").innerHTML = rows.length ? rows.join("") : "Chưa có lần chạy tự động nào.";
  renderStockAutomationRuntime(lastRuns);
}

function fillAutomation(data) {
  const settings = data.settings;
  $("#telegramChatId").value = settings.telegram.chatId || "";
  $("#automationEnabled").checked = settings.enabled;
  $("#dailyEnabled").checked = settings.schedules.cryptoDaily.enabled;
  $("#dailyTime").value = settings.schedules.cryptoDaily.time;
  $("#weeklyEnabled").checked = settings.schedules.cryptoWeekly.enabled;
  $("#weeklyDay").value = String(settings.schedules.cryptoWeekly.day);
  $("#weeklyTime").value = settings.schedules.cryptoWeekly.time;
  $("#metalsDailyEnabled").checked = settings.schedules.metalsDaily.enabled;
  $("#metalsDailyTime").value = settings.schedules.metalsDaily.time;
  $("#stockDailyEnabled").checked = settings.schedules.stockDaily.enabled;
  $("#stockDailyTime").value = settings.schedules.stockDaily.time;
  $("#focusScheduleEnabled").checked = settings.schedules.focusScan.enabled;
  $("#closedCandleMinute").value = String(settings.schedules.closedCandle.minute);
  updateClosedCandleSchedulePreview();
  $("#newCoinScheduleEnabled").checked = settings.schedules.newCoinScan.enabled;
  $("#dex4hScheduleEnabled").checked = settings.schedules.dex4h.enabled;
  $("#dex8hScheduleEnabled").checked = settings.schedules.dex8h.enabled;
  $("#sendNoSignalSummary").checked = settings.telegram.sendNoSignalSummary;
  $("#autoCexEnabled").checked = settings.assets.cex.enabled;
  $("#autoDexEnabled").checked = settings.assets.dex.enabled;
  $("#autoStockEnabled").checked = settings.assets.stocks.enabled;
  $("#autoStockSymbols").value = (settings.assets.stocks.watchlist || []).join(", ");
  const stockScopes = new Set(settings.assets.stocks.scopes?.length ? settings.assets.stocks.scopes : ["WATCHLIST"]);
  document.querySelectorAll(".auto-stock-scope").forEach(input => { input.checked = stockScopes.has(input.value); });
  $("#autoCexSymbols").value = (settings.assets.cex.watchlist.length ? settings.assets.cex.watchlist : config.symbols).join(", ");
  $("#autoDexTokens").value = settings.assets.dex.watchlist.map(item => `${item.network}:${item.tokenAddress}${item.poolAddress ? `:${item.poolAddress}` : ""}`).join("\n");
  const configured = data.capabilities.telegramConfigured;
  $("#telegramStatus").textContent = configured ? "Bot token: đã cấu hình" : "Thiếu TELEGRAM_BOT_TOKEN";
  $("#telegramStatus").className = `status-pill ${configured ? "ok" : "error"}`;
  renderLastRuns(data.state?.lastRuns);
}

function collectAutomation() {
  return {
    schemaVersion: 8,
    enabled: $("#automationEnabled").checked,
    telegram: {
      chatId: $("#telegramChatId").value.trim(),
      sendNoSignalSummary: $("#sendNoSignalSummary").checked,
      sendErrors: false
    },
    assets: {
      cex: { enabled: $("#autoCexEnabled").checked, watchlist: parseSymbols($("#autoCexSymbols").value) },
      dex: { enabled: $("#autoDexEnabled").checked, watchlist: parseDexTokens($("#autoDexTokens").value) },
      metals: automationSnapshot.settings.assets.metals,
      stocks: {
        enabled: $("#autoStockEnabled").checked,
        watchlist: parseSymbols($("#autoStockSymbols").value),
        scopes: [...document.querySelectorAll(".auto-stock-scope:checked")].map(input => input.value),
        provider: "SSI"
      }
    },
    schedules: {
      cryptoDaily: { enabled: $("#dailyEnabled").checked, time: $("#dailyTime").value },
      cryptoWeekly: { enabled: $("#weeklyEnabled").checked, day: Number($("#weeklyDay").value), time: $("#weeklyTime").value },
      closedCandle: { minute: Number($("#closedCandleMinute").value) },
      focusScan: { enabled: $("#focusScheduleEnabled").checked },
      newCoinScan: { enabled: $("#newCoinScheduleEnabled").checked },
      dex4h: { enabled: $("#dex4hScheduleEnabled").checked },
      dex8h: { enabled: $("#dex8hScheduleEnabled").checked },
      metalsDaily: { enabled: $("#metalsDailyEnabled").checked, time: $("#metalsDailyTime").value },
      stockDaily: { enabled: $("#stockDailyEnabled").checked, time: $("#stockDailyTime").value },
      stockWeekly: automationSnapshot.settings.schedules.stockWeekly
    }
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function saveAutomationSettings(showMessage = true) {
  const data = await api("/api/automation", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(collectAutomation()) });
  automationSnapshot.settings = data.settings;
  if (showMessage) $("#automationState").textContent = "Đã lưu cấu hình. Có thể sửa và lưu lại bất cứ lúc nào.";
  return data.settings;
}

fillAutomation(automationSnapshot);

async function refreshAutomationRuntime() {
  try {
    const data = await api("/api/automation");
    automationSnapshot.state = data.state;
    renderLastRuns(data.state?.lastRuns || {});
  } catch { /* keep the last visible runtime state on transient UI polling errors */ }
}
setInterval(refreshAutomationRuntime, 5000);

function remainingText(expiresAt, now = Date.now()) {
  const milliseconds = expiresAt - now;
  if (milliseconds <= 0) return "Đã hết hạn";
  const days = Math.floor(milliseconds / 86_400_000);
  const hours = Math.ceil((milliseconds % 86_400_000) / 3_600_000);
  return days ? `${days} ngày ${hours} giờ` : `${hours} giờ`;
}

async function loadFocusList() {
  const data = await api("/api/focus");
  $("#focusCount").textContent = `${data.items.filter(item => item.expiresAt > data.now).length} coin đang chạy`;
  $("#focusResults").innerHTML = data.items.length ? data.items.sort((a, b) => a.expiresAt - b.expiresAt).map(item => {
    const active = item.expiresAt > data.now;
    return `<tr><td><a class="chart-link" data-chart-exchange="${h(item.exchange)}" data-chart-symbol="${h(item.instrumentId)}" data-chart-timeframe="${h(item.timeframe)}" href="${h(chartUrl(item.exchange, item.instrumentId, item.timeframe, "focus"))}">${h(item.asset)}</a></td><td><span class="exchange ${h(item.exchange.toLowerCase())}">${h(item.exchange)}</span><small>${h(item.instrumentId)}</small></td><td><span class="badge ${h(item.direction.toLowerCase())}">${h(item.direction)}</span></td><td>${h(item.timeframe)}</td><td class="${active ? "active-time" : "expired"}">${h(remainingText(item.expiresAt, data.now))}</td><td class="row-actions"><button class="secondary focus-action" data-extend="${h(item.asset)}">+7 ngày</button><button class="focus-action sell-action" data-delete="${h(item.asset)}">Xóa</button></td></tr>`;
  }).join("") : `<tr><td colspan="6">Chưa có coin nào. Sau khi quét D1, bấm “+ BUY” hoặc “+ SELL” ở tín hiệu bạn muốn theo dõi.</td></tr>`;
}

function formatAddedAt(timestamp) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(timestamp);
}

async function loadNewCoinList(message = "") {
  const data = await api("/api/new-coins");
  const activeCount = data.items.filter(item => !item.paused).length;
  $("#newCoinCount").textContent = `${data.items.length} coin · ${activeCount} hoạt động`;
  $("#newCoinResults").innerHTML = data.items.length ? [...data.items].sort((a, b) => b.addedAt - a.addedAt).map(item => {
    const encodedId = h(item.id);
    const status = item.paused ? "TẠM DỪNG" : "HOẠT ĐỘNG";
    return `<tr><td><strong>${h(item.asset)}</strong></td><td><span class="exchange ${h(item.exchange.toLowerCase())}">${h(item.exchange)}</span><small>${h(item.instrumentId)}</small></td><td><span class="badge ${item.paused ? "paused" : "running"}">${status}</span></td><td>${h(formatAddedAt(item.addedAt))}</td><td><a class="chart-link" data-chart-exchange="${h(item.exchange)}" data-chart-symbol="${h(item.instrumentId)}" data-chart-timeframe="8H" href="${h(chartUrl(item.exchange, item.instrumentId, "8H", "new-coins"))}">Mở 8H</a><small>có 1H · 4H · 8H</small></td><td class="row-actions"><button class="secondary new-coin-action" data-new-coin-pause="${encodedId}" data-paused="${item.paused}">${item.paused ? "Tiếp tục" : "Tạm dừng"}</button><button class="new-coin-action delete" data-new-coin-delete="${encodedId}">Xóa</button></td></tr>`;
  }).join("") : '<tr><td colspan="6">Chưa có coin mới. Nhập mã coin hoặc cặp Spot để hệ thống tự tìm sàn.</td></tr>';
  if (message) $("#newCoinState").textContent = message;
}

$("#newCoinForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("#addNewCoin");
  button.disabled = true;
  $("#newCoinState").textContent = "Đang kiểm tra cặp Spot…";
  try {
    const instrumentId = $("#newCoinSymbol").value.trim().toUpperCase();
    const result = await api("/api/new-coins", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ instrumentId }) });
    $("#newCoinSymbol").value = "";
    await loadNewCoinList(`Đã tìm thấy và ghim ${result.entry.exchange}:${result.entry.instrumentId}.`);
  } catch (error) { $("#newCoinState").textContent = `Lỗi: ${error.message}`; }
  finally { button.disabled = false; }
});

$("#newCoinResults").addEventListener("click", async event => {
  const pause = event.target.closest("[data-new-coin-pause]");
  const remove = event.target.closest("[data-new-coin-delete]");
  if (!pause && !remove) return;
  const button = pause || remove;
  button.disabled = true;
  try {
    if (pause) {
      const paused = pause.dataset.paused !== "true";
      await api(`/api/new-coins/${encodeURIComponent(pause.dataset.newCoinPause)}/pause`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ paused }) });
      await loadNewCoinList(paused ? "Đã tạm dừng coin; dữ liệu vẫn được giữ." : "Đã đưa coin trở lại trạng thái hoạt động.");
    } else {
      await api(`/api/new-coins/${encodeURIComponent(remove.dataset.newCoinDelete)}`, { method: "DELETE" });
      await loadNewCoinList("Đã xóa coin khỏi watchlist Coin mới.");
    }
  } catch (error) { $("#newCoinState").textContent = `Lỗi: ${error.message}`; button.disabled = false; }
});

async function runNewCoinsNow(button, stateTarget = $("#newCoinState")) {
  button.disabled = true;
  stateTarget.textContent = `Đang quét Coin mới ${newCoinTimeframe} và gửi Telegram…`;
  try {
    const result = await api("/api/new-coins/run", { method: "POST" });
    stateTarget.textContent = `Đã quét ${result.total} coin · bỏ qua ${result.paused} tạm dừng · gửi ${result.sentSignals} tín hiệu · ${result.errors} lỗi.`;
    automationSnapshot = await api("/api/automation");
    renderLastRuns(automationSnapshot.state.lastRuns);
  } catch (error) { stateTarget.textContent = `Lỗi: ${error.message}`; }
  finally { button.disabled = false; }
}

$("#runNewCoinsNow").addEventListener("click", event => runNewCoinsNow(event.currentTarget));

$("#focusResults").addEventListener("click", async event => {
  const extend = event.target.closest("[data-extend]");
  const remove = event.target.closest("[data-delete]");
  if (!extend && !remove) return;
  const button = extend || remove;
  button.disabled = true;
  try {
    if (extend) await api(`/api/focus/${encodeURIComponent(extend.dataset.extend)}/extend`, { method: "POST" });
    else await api(`/api/focus/${encodeURIComponent(remove.dataset.delete)}`, { method: "DELETE" });
    await loadFocusList();
  } catch (error) { $("#focusState").textContent = `Lỗi: ${error.message}`; button.disabled = false; }
});

$("#runFocusNow").addEventListener("click", async event => {
  const button = event.currentTarget; button.disabled = true; $("#focusState").textContent = `Đang quét ${focusTimeframes.join("/")}…`;
  try {
    const result = await api("/api/focus/run", { method: "POST" });
    $("#focusState").textContent = `Đã quét ${result.total} coin · khớp ${result.matchedSignals} · gửi ${result.sentSignals} cảnh báo.`;
  } catch (error) { $("#focusState").textContent = `Lỗi: ${error.message}`; }
  finally { button.disabled = false; }
});

await loadFocusList();
await loadNewCoinList();

$("#autoCexFile").addEventListener("change", () => importTextFile($("#autoCexFile"), $("#autoFileState"), (text, name) => {
  const symbols = parseSymbols(text);
  if (!symbols.length) throw new Error("Không tìm thấy ticker hợp lệ");
  $("#autoCexSymbols").value = symbols.join(", ");
  $("#autoFileState").textContent = `Đã nạp ${symbols.length} coin CEX từ ${name}. Bấm Lưu cấu hình để áp dụng.`;
}));

$("#autoDexFile").addEventListener("change", () => importTextFile($("#autoDexFile"), $("#autoFileState"), (text, name) => {
  const tokens = parseDexTokens(text);
  if (!tokens.length) throw new Error("Không tìm thấy token address hợp lệ");
  $("#autoDexTokens").value = tokens.map(item => `${item.network}:${item.tokenAddress}${item.poolAddress ? `:${item.poolAddress}` : ""}`).join("\n");
  $("#autoFileState").textContent = `Đã nạp ${tokens.length} token DEX từ ${name}. Bấm Lưu cấu hình để áp dụng.`;
}));

$("#autoStockFile").addEventListener("change", () => importTextFile($("#autoStockFile"), $("#autoFileState"), (text, name) => {
  const symbols = parseSymbols(text);
  if (!symbols.length) throw new Error("Không tìm thấy mã Stock hợp lệ");
  $("#autoStockSymbols").value = symbols.join(", ");
  $("#autoFileState").textContent = `Đã nạp ${symbols.length} mã Stock từ ${name}. Bấm Lưu cấu hình để áp dụng.`;
}));

$("#prepareAutoStocks").addEventListener("click", async event => {
  const button = event.currentTarget;
  const raw = String($("#autoStockSymbols").value || "").trim();
  const symbols = parseSymbols(raw);
  if (!symbols.length) { $("#autoStockPrepareState").textContent = "Hãy nhập hoặc nạp ít nhất một mã Stock."; return; }
  button.disabled = true;
  $("#autoStockPrepareState").textContent = `Đang kiểm tra và chuẩn bị ${symbols.length} mã…`;
  try {
    const response = await fetch("/api/stocks/instruments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symbols, years: 3 }) });
    const data = await response.json();
    if (!response.ok && response.status !== 207) throw new Error(data.error || `HTTP ${response.status}`);
    const added = data.added?.length || 0;
    const prepared = data.prepared?.length ?? data.skipped?.length ?? 0;
    const retried = data.retried?.length || 0;
    const failed = data.failed?.length || 0;
    $("#autoStockPrepareState").textContent = `Chuẩn bị xong · thêm mới ${added} · đã chuẩn bị ${prepared} · backfill lại ${retried} · lỗi ${failed}${failed ? ` (${data.failed.map(item => item.symbol).join(", ")})` : ""}.`;
  } catch (error) { $("#autoStockPrepareState").textContent = `Lỗi chuẩn bị Stock: ${error.message}`; }
  finally { button.disabled = false; }
});

$("#saveAutomation").addEventListener("click", async () => {
  const button = $("#saveAutomation"); button.disabled = true; $("#automationState").textContent = "Đang lưu…";
  try { await saveAutomationSettings(); }
  catch (error) { $("#automationState").textContent = `Lỗi: ${error.message}`; }
  finally { button.disabled = false; }
});

$("#findChats").addEventListener("click", async () => {
  const button = $("#findChats"); button.disabled = true; $("#chatHelp").textContent = "Đang đọc các cuộc trò chuyện gần đây của bot…";
  try {
    const data = await api("/api/automation/chats", { method: "POST" });
    if (!data.chats.length) throw new Error("Chưa tìm thấy chat. Hãy nhắn /start cho bot rồi thử lại");
    const select = $("#chatCandidates");
    select.innerHTML = `<option value="">Chọn một chat…</option>${data.chats.map(chat => `<option value="${h(chat.id)}">${h(chat.title)} · ${h(chat.type)} · ${h(chat.id)}</option>`).join("")}`;
    select.classList.remove("hidden");
    if (data.chats.length === 1) { select.value = data.chats[0].id; $("#telegramChatId").value = data.chats[0].id; }
    $("#chatHelp").textContent = `Tìm thấy ${data.chats.length} chat. Chọn đúng nơi nhận cảnh báo.`;
  } catch (error) { $("#chatHelp").textContent = `Lỗi: ${error.message}`; }
  finally { button.disabled = false; }
});

$("#chatCandidates").addEventListener("change", event => { if (event.target.value) $("#telegramChatId").value = event.target.value; });

$("#testTelegram").addEventListener("click", async () => {
  const button = $("#testTelegram"); button.disabled = true; $("#automationState").textContent = "Đang gửi tin thử…";
  try { await saveAutomationSettings(false); await api("/api/automation/test", { method: "POST" }); $("#automationState").textContent = "Telegram đã nhận tin thử thành công."; }
  catch (error) { $("#automationState").textContent = `Lỗi: ${error.message}`; }
  finally { button.disabled = false; }
});

async function runNow(timeframe, button) {
  button.disabled = true; $("#automationState").textContent = `Đang quét ${timeframe} và gửi Telegram…`;
  try {
    await saveAutomationSettings(false);
    const result = await api("/api/automation/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ timeframe }) });
    $("#automationState").textContent = `${timeframe}: đã quét ${result.total} mã, gửi ${result.sentSignals} tín hiệu.`;
    automationSnapshot = await api("/api/automation"); renderLastRuns(automationSnapshot.state.lastRuns);
  } catch (error) { $("#automationState").textContent = `Lỗi: ${error.message}`; }
  finally { button.disabled = false; }
}

$("#runDailyNow").addEventListener("click", event => runNow("1D", event.currentTarget));
$("#runWeeklyNow").addEventListener("click", event => runNow("1W", event.currentTarget));
async function runMetalsNow(button) {
  button.disabled = true; $("#automationState").textContent = "Đang quét 3 sản phẩm Vàng–Bạc SELL D1 và gửi Telegram…";
  try {
    await saveAutomationSettings(false);
    const result = await api("/api/automation/metals/run", { method: "POST" });
    $("#automationState").textContent = `Vàng–Bạc SELL D1: đã quét ${result.total} sản phẩm, gửi ${result.sentSignals} tín hiệu, ${result.errors} lỗi.`;
    automationSnapshot = await api("/api/automation"); renderLastRuns(automationSnapshot.state.lastRuns);
  } catch (error) { $("#automationState").textContent = `Lỗi: ${error.message}`; }
  finally { button.disabled = false; }
}
$("#runMetalsDailyNow").addEventListener("click", event => runMetalsNow(event.currentTarget));
async function runStocksNow(button) {
  button.disabled = true; $("#automationState").textContent = "Đang Daily Sync Stock → quét D1 → gửi Telegram…";
  try {
    await saveAutomationSettings(false);
    const result = await api("/api/automation/stocks/run", { method: "POST" });
    $("#automationState").textContent = `Stock D1: sync ${result.synced} mã · quét ${result.total} mã · gửi ${result.sentSignals} tín hiệu · ${result.errors} lỗi.`;
    automationSnapshot = await api("/api/automation"); renderLastRuns(automationSnapshot.state.lastRuns);
  } catch (error) {
    $("#automationState").textContent = `Lỗi: ${error.message}`;
    try { automationSnapshot = await api("/api/automation"); renderLastRuns(automationSnapshot.state.lastRuns); } catch {}
  }
  finally { button.disabled = false; }
}
$("#runStocksDailyNow").addEventListener("click", event => runStocksNow(event.currentTarget));
async function runDexNow(timeframe, button) {
  button.disabled = true; $("#automationState").textContent = `Đang quét DEX ${timeframe} và gửi Telegram…`;
  try {
    await saveAutomationSettings(false);
    const result = await api("/api/automation/dex/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ timeframe }) });
    $("#automationState").textContent = `DEX ${timeframe}: đã quét ${result.total} token, gửi ${result.sentSignals} tín hiệu.`;
    automationSnapshot = await api("/api/automation"); renderLastRuns(automationSnapshot.state.lastRuns);
  } catch (error) { $("#automationState").textContent = `Lỗi: ${error.message}`; }
  finally { button.disabled = false; }
}

$("#runDex4hNow").addEventListener("click", event => runDexNow("4H", event.currentTarget));
$("#runDex8hNow").addEventListener("click", event => runDexNow("8H", event.currentTarget));
$("#runNewCoinsAutomationNow").addEventListener("click", async event => {
  await runNewCoinsNow(event.currentTarget, $("#automationState"));
});
