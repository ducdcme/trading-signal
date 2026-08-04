# Changelog

## 2.5.0 - 2026-08-04

- Thêm dữ liệu Spot công khai cho Bitget, KuCoin, Gate.io và MEXC.
- Chốt thứ tự sàn: Binance → OKX → Bybit → Bitget → KuCoin → Gate.io → MEXC.
- Mỗi coin chỉ được quét trên một sàn; API lỗi không làm hệ thống tự chuyển sàn.
- Adapter CEX hỗ trợ trực tiếp nến 1H, 4H và D1; W1 tiếp tục tổng hợp từ D1 UTC.
- Thêm danh sách theo dõi điểm vào thủ công trong 7 ngày.
- D1 BUY tìm BUY khung nhỏ; D1 SELL tìm SELL khung nhỏ.
- Khung mặc định 1H, tùy chọn 4H; tự quét vào phút thứ 5 mỗi giờ.
- Thêm giao diện thêm, xem, gia hạn, xóa và quét ngay danh sách theo dõi.
- Nâng cấu hình runtime lên schema v3, tự đọc cấu hình cũ.
- Thêm kiểm thử cho adapter mới và vòng đời danh sách theo dõi.
