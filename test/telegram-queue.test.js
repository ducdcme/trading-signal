import test from "node:test";
import assert from "node:assert/strict";
import { createPendingTelegram, reschedulePendingTelegram, telegramQueueDue, telegramRetryDelaysMs } from "../lib/telegram-queue.js";

test("Telegram queue defaults to delayed 5 then 10 minute retries", () => {
  assert.deepEqual(telegramRetryDelaysMs(undefined).slice(0, 3), [300000, 600000, 600000]);
});

test("Telegram queue persists rendered message and schedules first retry", () => {
  const item = createPendingTelegram({ id: "batch:slot", slot: "2026-10-24|07:10", chatId: "123", text: "report", sentKeys: ["a", "a", "b"], now: 1000, errorCode: "ETIMEDOUT" }, [300000, 600000]);
  assert.equal(item.attempts, 1);
  assert.equal(item.nextRetryAt, 301000);
  assert.deepEqual(item.sentKeys, ["a", "b"]);
  assert.equal(telegramQueueDue(item, 300999), false);
  assert.equal(telegramQueueDue(item, 301000), true);
});

test("Telegram queue reschedules without rerunning the scan and eventually exhausts", () => {
  const delays = [300000, 600000];
  let item = createPendingTelegram({ id: "batch:slot", slot: "slot", chatId: "123", text: "already rendered", now: 0 }, delays);
  item = reschedulePendingTelegram(item, 300000, "ETIMEDOUT", delays);
  assert.equal(item.status, "PENDING");
  assert.equal(item.attempts, 2);
  assert.equal(item.nextRetryAt, 900000);
  item = reschedulePendingTelegram(item, 900000, "ETIMEDOUT", delays);
  assert.equal(item.status, "FAILED");
  assert.equal(item.attempts, 3);
  assert.equal(item.nextRetryAt, null);
  assert.equal(item.text, "already rendered");
});
