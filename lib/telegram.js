const API_ROOT = "https://api.telegram.org";

function requireToken(token) {
  const value = String(token ?? "").trim();
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(value)) throw new Error("TELEGRAM_BOT_TOKEN chưa được cấu hình hoặc không hợp lệ");
  return value;
}

async function callTelegram(token, method, body) {
  const response = await fetch(`${API_ROOT}/bot${requireToken(token)}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
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

export async function sendTelegramText(token, chatId, text) {
  const target = String(chatId ?? "").trim();
  if (!target) throw new Error("Chưa có Telegram Chat ID");
  const messages = [];
  for (const chunk of splitTelegramText(text)) {
    messages.push(await callTelegram(token, "sendMessage", { chat_id: target, text: chunk, disable_web_page_preview: true }));
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
