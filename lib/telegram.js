const API_ROOT = "https://api.telegram.org";

function requireToken(token) {
  const value = String(token ?? "").trim();
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(value)) throw new Error("TELEGRAM_BOT_TOKEN chưa được cấu hình hoặc không hợp lệ");
  return value;
}

function numberEnv(name, fallback, minimum = 0) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.max(minimum, value) : fallback;
}

function transportCodes(error) {
  const codes = new Set();
  const visit = value => {
    if (!value || typeof value !== "object") return;
    if (value.code) codes.add(String(value.code).toUpperCase());
    if (Array.isArray(value.errors)) value.errors.forEach(visit);
    if (value.cause && value.cause !== value) visit(value.cause);
  };
  visit(error);
  return codes;
}

export function isTransientTransportError(error) {
  const codes = transportCodes(error);
  if (["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"].some(code => codes.has(code))) return true;
  const text = `${error?.name || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("fetch failed") || text.includes("timeout") || text.includes("timed out") || text.includes("aborterror");
}

function sleep(ms) {
  return ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve();
}

async function telegramFetch(url, options, deliveryOptions = {}) {
  const retries = Math.floor(Number.isFinite(Number(deliveryOptions.retries)) ? Math.max(0, Number(deliveryOptions.retries)) : numberEnv("TELEGRAM_REQUEST_RETRIES", 2));
  const retryDelayMs = Number.isFinite(Number(deliveryOptions.retryDelayMs)) ? Math.max(0, Number(deliveryOptions.retryDelayMs)) : numberEnv("TELEGRAM_RETRY_DELAY_MS", 1500);
  const timeoutMs = Number.isFinite(Number(deliveryOptions.timeoutMs)) ? Math.max(1000, Number(deliveryOptions.timeoutMs)) : numberEnv("TELEGRAM_REQUEST_TIMEOUT_MS", 20000, 1000);
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isTransientTransportError(error)) throw error;
      await sleep(retryDelayMs * (attempt + 1));
    }
  }
  throw lastError;
}

async function callTelegram(token, method, body, deliveryOptions = {}) {
  const response = await telegramFetch(`${API_ROOT}/bot${requireToken(token)}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }, deliveryOptions);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(`Telegram: ${data.description || `HTTP ${response.status}`}`);
  return data.result;
}

export function splitTelegramText(text, limit = 3900) {
  const chunks = [];
  let current = "";
  for (const line of String(text).split("\n")) {
    if (current && current.length + line.length + 1 > limit) {
      chunks.push(current);
      current = "";
    }
    if (line.length > limit) {
      if (current) chunks.push(current);
      for (let index = 0; index < line.length; index += limit) chunks.push(line.slice(index, index + limit));
    } else current += `${current ? "\n" : ""}${line}`;
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function sendTelegramText(token, chatId, text, deliveryOptions = {}) {
  const target = String(chatId ?? "").trim();
  if (!target) throw new Error("Chưa có Telegram Chat ID");
  const messages = [];
  for (const chunk of splitTelegramText(text)) {
    messages.push(await callTelegram(token, "sendMessage", { chat_id: target, text: chunk, disable_web_page_preview: true }, deliveryOptions));
  }
  return messages;
}

export async function findTelegramChats(token) {
  const updates = await callTelegram(token, "getUpdates", { limit: 100, timeout: 0, allowed_updates: ["message", "channel_post", "my_chat_member"] });
  const chats = new Map();
  for (const update of updates) {
    const chat = update.message?.chat ?? update.channel_post?.chat ?? update.my_chat_member?.chat;
    if (!chat) continue;
    const title = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || String(chat.id);
    chats.set(String(chat.id), { id: String(chat.id), title, type: chat.type, username: chat.username || "" });
  }
  return [...chats.values()];
}
