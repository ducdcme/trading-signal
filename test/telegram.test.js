import test from "node:test";
import assert from "node:assert/strict";
import { sendTelegramText } from "../lib/telegram.js";

const token = "123456:abcdefghijklmnopqrstuvwxyzABCDE";

function okResponse(result = { message_id: 1 }) {
  return {
    ok: true,
    status: 200,
    async json() { return { ok: true, result }; }
  };
}

test("Telegram retries transient fetch timeouts before succeeding", async () => {
  const originalFetch = globalThis.fetch;
  const oldRetries = process.env.TELEGRAM_REQUEST_RETRIES;
  const oldDelay = process.env.TELEGRAM_RETRY_DELAY_MS;
  process.env.TELEGRAM_REQUEST_RETRIES = "2";
  process.env.TELEGRAM_RETRY_DELAY_MS = "0";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls < 3) {
      const error = new TypeError("fetch failed");
      error.cause = { name: "AggregateError", code: "ETIMEDOUT" };
      throw error;
    }
    return okResponse();
  };
  try {
    const result = await sendTelegramText(token, "123", "hello");
    assert.equal(calls, 3);
    assert.equal(result.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldRetries === undefined) delete process.env.TELEGRAM_REQUEST_RETRIES; else process.env.TELEGRAM_REQUEST_RETRIES = oldRetries;
    if (oldDelay === undefined) delete process.env.TELEGRAM_RETRY_DELAY_MS; else process.env.TELEGRAM_RETRY_DELAY_MS = oldDelay;
  }
});

test("Telegram API errors are not retried as transport failures", async () => {
  const originalFetch = globalThis.fetch;
  const oldRetries = process.env.TELEGRAM_REQUEST_RETRIES;
  process.env.TELEGRAM_REQUEST_RETRIES = "2";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: false,
      status: 400,
      async json() { return { ok: false, description: "Bad Request" }; }
    };
  };
  try {
    await assert.rejects(() => sendTelegramText(token, "123", "hello"), /Telegram: Bad Request/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldRetries === undefined) delete process.env.TELEGRAM_REQUEST_RETRIES; else process.env.TELEGRAM_REQUEST_RETRIES = oldRetries;
  }
});


test("Telegram scheduled delivery can disable immediate retries", async () => {
  const originalFetch = globalThis.fetch;
  const oldRetries = process.env.TELEGRAM_REQUEST_RETRIES;
  process.env.TELEGRAM_REQUEST_RETRIES = "5";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    const error = new TypeError("fetch failed");
    error.cause = { name: "AggregateError", code: "ETIMEDOUT" };
    throw error;
  };
  try {
    await assert.rejects(() => sendTelegramText(token, "123", "hello", { retries: 0 }), /fetch failed/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldRetries === undefined) delete process.env.TELEGRAM_REQUEST_RETRIES; else process.env.TELEGRAM_REQUEST_RETRIES = oldRetries;
  }
});
