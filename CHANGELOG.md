# Changelog

## 2.5.2 - 2026-08-04

- Chọn thị trường từ catalog Spot đang giao dịch của từng sàn thay vì suy đoán từ dữ liệu nến lịch sử.
- Loại các cặp đã delist hoặc dừng giao dịch, kể cả khi API nến vẫn trả dữ liệu cũ (ví dụ `BLZUSDT`, `BEAMUSDT`).
- Chặn phát tín hiệu nếu nến cuối đã cũ quá hai chu kỳ của khung quét.
- Cache catalog 15 phút để mỗi sàn chỉ cần tải danh sách thị trường một lần trong một đợt quét.
- Hỗ trợ ưu tiên `USDT → USDC → FDUSD`; `FDUSD` chỉ được xét trên Binance.
- Bỏ tiền tố sàn khỏi watchlist TradingView trước khi quét để mã cũ như `BINANCE:BLZUSDT` không ghim coin vào một thị trường đã delist.
- Mã không có cặp đang giao dịch được ghi `SKIPPED` thay vì làm tăng bộ đếm lỗi API.

## 2.5.1 - 2026-08-04

- Sửa Bybit `Not supported symbols` bị hiểu nhầm là lỗi API, khiến AUTO dừng trước Bitget, KuCoin, Gate.io và MEXC.
- Thêm giới hạn tốc độ dùng chung cho các request OKX để tránh các worker đồng thời gây lỗi `429 Too Many Requests`.
- Tự thử lại OKX tối đa 3 lần với backoff khi gặp `429`; vẫn giữ nguyên nguyên tắc không âm thầm chuyển sàn khi API thật sự lỗi.
- Thêm kiểm thử hồi quy bảo đảm resolver tiếp tục từ Bybit sang Bitget khi cặp Spot không tồn tại.

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
