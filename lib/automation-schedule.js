import { isNewCoinScheduleDue } from "./new-coin-config.js";

const DEFAULT_RUNTIME = Object.freeze({
  timezone: "Asia/Ho_Chi_Minh",
  schedulerPollSeconds: 30
});

export function normalizeAutomationRuntimeConfig(input = {}) {
  const timezone = String(input.timezone || DEFAULT_RUNTIME.timezone).trim();
  const schedulerPollSeconds = Number(input.schedulerPollSeconds);
  let validTimezone = DEFAULT_RUNTIME.timezone;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    validTimezone = timezone;
  } catch {}
  return {
    timezone: validTimezone,
    schedulerPollSeconds: Number.isInteger(schedulerPollSeconds) && schedulerPollSeconds >= 10 && schedulerPollSeconds <= 300
      ? schedulerPollSeconds
      : DEFAULT_RUNTIME.schedulerPollSeconds
  };
}

export function dueAutomationJobs(clock, settings, config) {
  if (!settings?.enabled) return [];
  const schedules = settings.schedules || {};
  const focusHours = Array.isArray(config?.focus?.scanHours) ? config.focus.scanHours : [];
  const hour = Number(String(clock?.time || "").slice(0, 2));
  const minute = Number(String(clock?.time || "").slice(3));
  return [
    { key: "cryptoDaily", timeframe: "1D", due: schedules.cryptoDaily?.enabled && clock.time === schedules.cryptoDaily.time },
    { key: "cryptoWeekly", timeframe: "1W", due: schedules.cryptoWeekly?.enabled && clock.day === schedules.cryptoWeekly.day && clock.time === schedules.cryptoWeekly.time },
    { key: "focusScan", timeframe: "FOCUS", due: schedules.focusScan?.enabled && focusHours.includes(hour) && minute === schedules.focusScan.minute },
    { key: "newCoinScan", timeframe: "NEW_COIN", due: isNewCoinScheduleDue(clock, schedules.newCoinScan, config?.newCoins) }
  ].filter(job => job.due);
}
