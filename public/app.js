import { parseSymbols } from "./symbols.js";

const $ = selector => document.querySelector(selector);
const h = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const date = timestamp => new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(timestamp);
const price = value => Number.isFinite(value) ? value.toLocaleString("en-US", { maximumSignificantDigits: 10 }) : "—";
const shortAddress = value => value?.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
const signalTypes = row => [...(row.buyTypes ?? []), ...(row.sellTypes ?? []), ...(row.warnings ?? []), ...(row.exitTypes ?? []), ...(row.trendTypes ?? [])];

$("#logout").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  location.replace("/login.html");
});

const config = await fetch("/api/config").then(response => response.json());
$("#symbols").value = config.symbols.join(", ");
if (!config.capabilities?.dexWeekly) {
  $("#dexWeeklyOption").disabled = true;
  $("#dexWeeklyOption").textContent = "W1 · cần CoinGecko Analyst key";
}

let automationSnapshot = await fetch("/api/automation").then(response => response.json());

document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab === button));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === `panel-${button.dataset.tab}`));
}));

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

$("#watchlistFile").addEventListener("change", () => importTextFile($("#watchlistFile"), $("#fileState"), (text, name) => {
  const imported = parseSymbols(text);
  if (!imported.length) throw new Error("Không tìm thấy ticker hợp lệ");
  $("#symbols").value = imported.join(", ");
  $("#fileState").textContent = `Đã nhập ${imported.length} coin từ ${name}; vẫn có thể sửa trong ô bên dưới.`;
}));

$("#dexFile").addEventListener("change", () => importTextFile($("#dexFile"), $("#dexFileState"), (text, name) => {
  const imported = parseDexTokens(text);
  if (!imported.length) throw new Error("Không tìm thấy chain:token_address hợp lệ");
  $("#dexTokens").value = imported.map(item => `${item.network}:${item.tokenAddress}`).join("\n");
  $("#dexFileState").textContent = `Đã nhập ${imported.length} token address từ ${name}.`;
}));

function parseDexTokens(text) {
  const found = new Map();
  for (const raw of text.split(/[\r\n,;]+/)) {
    const line = raw.trim();
    if (!line || line.startsWith("###")) continue;
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`Thiếu blockchain trong dòng: ${line}`);
    const network = line.slice(0, separator).trim().toLowerCase();
    const tokenAddress = line.slice(separator + 1).trim();
    if (!network || !tokenAddress) throw new Error(`Dòng không hợp lệ: ${line}`);
    found.set(`${network}:${tokenAddress}`, { network, tokenAddress });
  }
  return [...found.values()];
}

function renderSummary(target, rows) {
  const counts = rows.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] ?? 0) + 1 }), {});
  target.innerHTML = ["BUY", "SELL", "BOTH", "NONE", "ERROR"].filter(key => counts[key]).map(key => `<div class="card ${key.toLowerCase()}"><b>${counts[key]}</b><span>${key}</span></div>`).join("");
}

const order = { BOTH: 0, BUY: 1, SELL: 2, NONE: 3, ERROR: 4 };

$("#scan").addEventListener("click", async () => {
  const button = $("#scan");
  button.disabled = true; $("#state").textContent = "Đang lấy dữ liệu và tính tín hiệu…"; $("#results").innerHTML = ""; $("#summary").innerHTML = "";
  try {
    const response = await fetch("/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symbols: parseSymbols($("#symbols").value), timeframe: $("#cexTimeframe").value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    renderSummary($("#summary"), data.results);
    $("#results").innerHTML = data.results.sort((a, b) => order[a.status] - order[b.status]).map(row => `<tr><td><strong>${h(row.instrumentId || row.requestedSymbol)}</strong></td><td><span class="exchange ${h(String(row.exchange).toLowerCase())}">${h(row.exchange)}</span></td><td>${h(row.timeframe || data.timeframe)}</td><td><span class="badge ${h(row.status.toLowerCase())}">${h(row.status)}</span></td><td>${h(row.error || signalTypes(row).join(", ") || "—")}</td><td>${price(row.close)}</td><td>${row.candleOpenTime ? date(row.candleOpenTime) : "—"}</td></tr>`).join("");
    $("#state").textContent = `Đã quét ${data.results.length} cặp · ${new Date(data.generatedAt).toLocaleTimeString("vi-VN")}`;
  } catch (error) { $("#state").textContent = `Lỗi: ${error.message}`; }
  finally { button.disabled = false; }
});

$("#scanDex").addEventListener("click", async () => {
  const button = $("#scanDex");
  button.disabled = true; $("#dexState").textContent = "Đang tìm pool và lấy nến; vui lòng chờ…"; $("#dexResults").innerHTML = ""; $("#dexSummary").innerHTML = "";
  try {
    const tokens = parseDexTokens($("#dexTokens").value);
    const response = await fetch("/api/scan/dex", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokens, timeframe: $("#dexTimeframe").value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    renderSummary($("#dexSummary"), data.results);
    $("#dexResults").innerHTML = data.results.sort((a, b) => order[a.status] - order[b.status]).map(row => {
      const types = row.error || signalTypes(row).join(", ") || "—";
      const pool = row.poolName ? `${row.poolName} · ${row.quoteSymbol} · $${Number(row.liquidityUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : row.error;
      return `<tr title="${h(row.tokenAddress)}"><td><strong>${h(row.instrumentId)}</strong><small class="address">${h(shortAddress(row.tokenAddress))}</small></td><td>${h(row.network)}<small>${h(row.dex || "—")}</small></td><td>${h(row.timeframe || data.timeframe)}</td><td><span class="badge ${h(row.status.toLowerCase())}">${h(row.status)}</span></td><td>${h(types)}</td><td>${h(pool || "—")}</td><td>${row.candleOpenTime ? date(row.candleOpenTime) : "—"}</td></tr>`;
    }).join("");
    $("#dexState").textContent = `Đã quét ${data.results.length} token · ${new Date(data.generatedAt).toLocaleTimeString("vi-VN")}`;
  } catch (error) { $("#dexState").textContent = `Lỗi: ${error.message}`; }
  finally { button.disabled = false; }
});

function renderLastRuns(lastRuns = {}) {
  const rows = ["crypto:1D", "crypto:1W"].map(key => [key, lastRuns[key] ?? lastRuns[key.slice(7)]]).filter(([, run]) => run).map(([key, run]) => {
    const timeframe = run.timeframe || key.slice(7);
    const detail = run.status === "ERROR" ? `Lỗi: ${run.error}` : `${run.total || 0} mã · ${run.sentSignals || 0} tín hiệu mới · ${run.errors || 0} lỗi`;
    return `<div><b>${timeframe}</b> · ${h(new Date(run.at).toLocaleString("vi-VN"))} · ${h(detail)}</div>`;
  });
  $("#lastRuns").innerHTML = rows.length ? rows.join("") : "Chưa có lần chạy tự động nào.";
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
  $("#sendNoSignalSummary").checked = settings.telegram.sendNoSignalSummary;
  $("#sendErrors").checked = settings.telegram.sendErrors;
  $("#autoCexEnabled").checked = settings.assets.cex.enabled;
  $("#autoDexEnabled").checked = settings.assets.dex.enabled;
  $("#autoCexSymbols").value = (settings.assets.cex.watchlist.length ? settings.assets.cex.watchlist : config.symbols).join(", ");
  $("#autoDexTokens").value = settings.assets.dex.watchlist.map(item => `${item.network}:${item.tokenAddress}`).join("\n");
  const configured = data.capabilities.telegramConfigured;
  $("#telegramStatus").textContent = configured ? "Bot token: đã cấu hình" : "Thiếu TELEGRAM_BOT_TOKEN";
  $("#telegramStatus").className = `status-pill ${configured ? "ok" : "error"}`;
  renderLastRuns(data.state?.lastRuns);
}

function collectAutomation() {
  return {
    schemaVersion: 2,
    enabled: $("#automationEnabled").checked,
    telegram: {
      chatId: $("#telegramChatId").value.trim(),
      sendNoSignalSummary: $("#sendNoSignalSummary").checked,
      sendErrors: $("#sendErrors").checked
    },
    assets: {
      cex: { enabled: $("#autoCexEnabled").checked, watchlist: parseSymbols($("#autoCexSymbols").value) },
      dex: { enabled: $("#autoDexEnabled").checked, watchlist: parseDexTokens($("#autoDexTokens").value) },
      stocks: automationSnapshot.settings.assets.stocks
    },
    schedules: {
      cryptoDaily: { enabled: $("#dailyEnabled").checked, time: $("#dailyTime").value },
      cryptoWeekly: { enabled: $("#weeklyEnabled").checked, day: Number($("#weeklyDay").value), time: $("#weeklyTime").value },
      stockDaily: automationSnapshot.settings.schedules.stockDaily,
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

$("#autoCexFile").addEventListener("change", () => importTextFile($("#autoCexFile"), $("#autoFileState"), (text, name) => {
  const symbols = parseSymbols(text);
  if (!symbols.length) throw new Error("Không tìm thấy ticker hợp lệ");
  $("#autoCexSymbols").value = symbols.join(", ");
  $("#autoFileState").textContent = `Đã nạp ${symbols.length} coin CEX từ ${name}. Bấm Lưu cấu hình để áp dụng.`;
}));

$("#autoDexFile").addEventListener("change", () => importTextFile($("#autoDexFile"), $("#autoFileState"), (text, name) => {
  const tokens = parseDexTokens(text);
  if (!tokens.length) throw new Error("Không tìm thấy token address hợp lệ");
  $("#autoDexTokens").value = tokens.map(item => `${item.network}:${item.tokenAddress}`).join("\n");
  $("#autoFileState").textContent = `Đã nạp ${tokens.length} token DEX từ ${name}. Bấm Lưu cấu hình để áp dụng.`;
}));

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
