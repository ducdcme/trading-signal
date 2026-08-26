import { formatScanErrorSummary } from "./scan-errors.js";
import { signalDisplayName } from "./signal-groups.js";

function scanCounts(rows) {
  return {
    total: rows.length,
    skipped: rows.filter(row => row.status === "SKIPPED").length,
    errors: rows.filter(row => row.status === "ERROR").length
  };
}

function reportPrice(row) {
  const value = Number(row.close);
  if (row.assetType === "METALS" && Number.isFinite(value)) return `${Math.round(value).toLocaleString("vi-VN")} ₫`;
  if (row.assetType === "STOCK" && Number.isFinite(value)) return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} nghìn ₫`;
  return row.close ?? "—";
}

export function formatAutomationReport(timeframe, rows, delivery, settings, trigger, assetLabel = "") {
  const icons = { BUY: "🟢", SELL: "🔴", BOTH: "🟡" };
  const lines = [
    `📊 Trading Signal${assetLabel ? ` · ${assetLabel}` : ""} · ${timeframe}`,
    `Thời điểm: ${new Date().toLocaleString("vi-VN", { timeZone: settings.timezone })}`,
    `Chế độ: ${trigger === "schedule" ? "Tự động" : "Chạy thủ công"}`,
    ""
  ];
  for (const row of delivery.delivered) {
    const types = [...(row.buySignalTypes || []), ...(row.sellSignalTypes || []), ...(row.warnings || []), ...(row.trendTypes || [])].map(signalDisplayName).join(", ") || row.status;
    const market = row.assetType === "DEX" ? `${row.network} · ${row.dex || "DEX"}` : row.assetType === "METALS" ? "SELL · Việt Nam" : row.exchange;
    const instrument = row.assetType === "METALS" ? row.productName || row.instrumentId : row.instrumentId || row.symbol;
    lines.push(`${icons[row.status] || "•"} ${instrument} · ${market}`);
    lines.push(`Tín hiệu: ${row.status} (${types}) · ${row.assetType === "METALS" ? "Giá bán đóng" : "Giá đóng"}: ${reportPrice(row)}`);
    if (row.assetType === "DEX") lines.push(`Contract: ${row.tokenAddress}`, `Pool: ${row.poolName || row.poolAddress || "—"}`);
    lines.push("");
  }
  const counts = delivery.delivered.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }), {});
  const scan = scanCounts(rows);
  if (delivery.delivered.length === 0 && settings.telegram.sendNoSignalSummary && trigger !== "schedule") lines.push("Không có tín hiệu BUY/SELL trên nến hiện tại.");
  if (delivery.suppressed) lines.push(`Đã bỏ qua ${delivery.suppressed} tín hiệu đã gửi trước đó.`);
  lines.push(`Đã quét: ${scan.total} · Tín hiệu gửi: BUY ${counts.BUY || 0} · SELL ${counts.SELL || 0} · BOTH ${counts.BOTH || 0}`);
  lines.push(`Bỏ qua: ${scan.skipped} · Lỗi: ${scan.errors}`);
  if (scan.errors) lines.push(`Loại lỗi: ${formatScanErrorSummary(rows)}`);
  return lines.join("\n");
}

function compactScheduledHeading(line) {
  const raw = String(line || "")
    .replace(/^[^A-Za-zÀ-ỹ0-9]+/u, "")
    .replace(/^Trading Signal\s*·\s*/i, "")
    .trim();
  const parts = raw.split("·").map(part => part.trim()).filter(Boolean);
  if (!parts.length) return "📊 BÁO CÁO";
  if (parts[0] === "1D" || parts[0] === "1W" || /^\d+[HM]$/.test(parts[0])) return `📊 COIN · ${parts.join(" · ")}`;
  if (parts[0] === "CEX") return `📊 COIN · ${parts.slice(1).join(" · ")}`;
  if (parts[0] === "VÀNG & BẠC SELL") return `🥇 VÀNG & BẠC · SELL · ${parts.slice(1).join(" · ")}`;
  if (parts[0] === "CHỨNG KHOÁN VN") return `📈 CHỨNG KHOÁN · ${parts.slice(1).join(" · ")}`;
  if (parts[0] === "DEX") return `🧩 DEX · ${parts.slice(1).join(" · ")}`;
  if (parts[0].toUpperCase() === "COIN MỚI") return `🆕 COIN MỚI · ${parts.slice(1).join(" · ")}`;
  return `📊 ${parts.join(" · ")}`;
}

function scheduledReportBody(report) {
  const lines = String(report || "").split("\n");
  const modeIndex = lines.findIndex(line => line.startsWith("Chế độ:"));
  const body = modeIndex >= 0 ? lines.slice(modeIndex + 1) : lines;
  while (body[0] === "") body.shift();
  return [compactScheduledHeading(lines[0]), ...body].filter(Boolean).join("\n");
}

export function formatScheduledBatchReport(reports, settings, at = new Date(), failures = []) {
  const sections = (Array.isArray(reports) ? reports : [])
    .map(scheduledReportBody)
    .filter(Boolean);
  const failed = Array.isArray(failures) ? failures.filter(Boolean) : [];
  if (failed.length) {
    sections.push([
      "⚠️ Lỗi nhóm tự động",
      ...failed.map(item => `• ${item.label || item.key || "Nhóm"} · Lỗi: ${Number(item.errors) || 1}`),
      `Tổng lỗi nhóm: ${failed.reduce((sum, item) => sum + (Number(item.errors) || 1), 0)}`
    ].join("\n"));
  }
  return [
    "📨 Trading Signal · Báo cáo tự động",
    `Thời điểm: ${at.toLocaleString("vi-VN", { timeZone: settings.timezone })}`,
    "",
    sections.join("\n\n")
  ].filter((line, index, all) => line || (index > 0 && index < all.length - 1)).join("\n");
}
