const DEFAULT_RETRY_MINUTES = [5, 10, 10, 10, 10, 10];

export function telegramRetryDelaysMs(value = process.env.TELEGRAM_QUEUE_RETRY_MINUTES) {
  const parsed = String(value ?? "")
    .split(",")
    .map(item => Number(item.trim()))
    .filter(item => Number.isFinite(item) && item > 0)
    .slice(0, 12)
    .map(minutes => Math.round(minutes * 60_000));
  return parsed.length ? parsed : DEFAULT_RETRY_MINUTES.map(minutes => minutes * 60_000);
}

export function createPendingTelegram({ id, slot, chatId, text, sentKeys = [], now = Date.now(), errorCode = "" }, retryDelays = telegramRetryDelaysMs()) {
  return {
    id: String(id || slot || now),
    slot: String(slot || ""),
    chatId: String(chatId || ""),
    text: String(text || ""),
    sentKeys: [...new Set(Array.isArray(sentKeys) ? sentKeys : [])].slice(-5000),
    attempts: 1,
    createdAt: now,
    nextRetryAt: now + retryDelays[0],
    lastErrorCode: String(errorCode || ""),
    status: "PENDING"
  };
}

export function telegramQueueDue(item, now = Date.now()) {
  return item?.status === "PENDING" && Number(item.nextRetryAt || 0) <= now;
}

export function reschedulePendingTelegram(item, now = Date.now(), errorCode = "", retryDelays = telegramRetryDelaysMs()) {
  const attempts = Math.max(1, Number(item?.attempts || 1)) + 1;
  const retryIndex = attempts - 1;
  if (retryIndex >= retryDelays.length) {
    return { ...item, attempts, lastErrorCode: String(errorCode || ""), status: "FAILED", nextRetryAt: null };
  }
  return {
    ...item,
    attempts,
    lastErrorCode: String(errorCode || ""),
    status: "PENDING",
    nextRetryAt: now + retryDelays[retryIndex]
  };
}
