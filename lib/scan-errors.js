export function scanErrorType(error) {
  const message = String(error?.message || error || "");
  if (/(?:timeout|timed out|TimeoutError|aborted due to timeout)/i.test(message)) return "Timeout";
  if (/\b429\b|too many requests|rate.?limit/i.test(message)) return "Rate limit";
  if (/\b5\d\d\b|bad gateway|service unavailable|gateway timeout/i.test(message)) return "API 5xx";
  if (/fetch failed|network|socket|ECONN|EAI_AGAIN|ENOTFOUND/i.test(message)) return "Lỗi mạng";
  if (/không đủ dữ liệu/i.test(message)) return "Thiếu dữ liệu";
  if (/không có nến .* mới|nến cuối/i.test(message)) return "Dữ liệu cũ";
  return "Lỗi API khác";
}

export function summarizeScanErrors(rows) {
  const counts = new Map();
  for (const row of rows.filter(item => item.status === "ERROR")) {
    const type = scanErrorType(row.error);
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count }));
}

export function formatScanErrorSummary(rows) {
  return summarizeScanErrors(rows).map(item => `${item.type}: ${item.count}`).join(" · ");
}
