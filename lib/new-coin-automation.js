import { signalDisplayName } from "./signal-groups.js";
import { formatScanErrorSummary } from "./scan-errors.js";

export function activeNewCoinItems(items) {
  return (Array.isArray(items) ? items : []).filter(item => item.paused !== true);
}

export function formatNewCoinReport(rows, delivery, settings, trigger, timeframe = "8H") {
  const icons = { BUY: "🟢", SELL: "🔴", BOTH: "🟡" };
  const errors = rows.filter(row => row.status === "ERROR");
  const lines = [
    `🆕 Trading Signal · Coin mới · ${timeframe}`,
    `Thời điểm: ${new Date().toLocaleString("vi-VN", { timeZone: settings.timezone })}`,
    `Chế độ: ${trigger === "schedule" ? "Tự động" : "Chạy thủ công"}`,
    ""
  ];
  for (const row of delivery.delivered) {
    const types = [...(row.buySignalTypes || []), ...(row.sellSignalTypes || []), ...(row.warnings || []), ...(row.trendTypes || [])]
      .map(signalDisplayName).join(", ") || row.status;
    lines.push(
      `${icons[row.status] || "•"} ${row.instrumentId || row.symbol} · ${row.exchange}`,
      `Tín hiệu: ${row.status} (${types}) · Giá đóng: ${row.close ?? "—"}`,
      ""
    );
  }
  const counts = delivery.delivered.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }), {});
  if (!delivery.delivered.length && settings.telegram.sendNoSignalSummary && trigger !== "schedule") lines.push("Không có tín hiệu BUY/SELL trên nến 8H gần nhất.");
  if (delivery.suppressed) lines.push(`Đã bỏ qua ${delivery.suppressed} tín hiệu đã gửi trước đó.`);
  lines.push(`Đã quét: ${rows.length} · Tín hiệu gửi: BUY ${counts.BUY || 0} · SELL ${counts.SELL || 0} · BOTH ${counts.BOTH || 0}`);
  lines.push(`Tạm dừng: ${delivery.paused || 0} · Lỗi: ${errors.length}`);
  if (errors.length) lines.push(`Loại lỗi: ${formatScanErrorSummary(rows)}`);
  return lines.join("\n");
}
