# Tự động hóa và Telegram

## Trạng thái v3.1.0

- DEX `4H/8H` đã có scheduler, nút chạy tay, Telegram theo đúng pool ghim và chống gửi trùng theo pool.
- Theo dõi 4H/8H, Coin mới 8H và DEX 4H/8H dùng chung một cấu hình phút chờ sau nến đóng.
- Các job tự động trùng thời điểm được gom thành một bản tin Telegram; lượt không có tín hiệu chỉ hiển thị thống kê quét.
- Bản `3.1.0` đã qua 120/120 test và sẵn sàng triển khai production.

## Trạng thái v3.0.1

- Nến 8H đã được tổng hợp từ đúng hai nến 4H đã đóng theo ranh giới UTC.
- Chart 8H đã hiển thị nến đang chạy giống D1; scheduler vẫn chỉ dùng nến đóng.
- Watchlist Coin mới đã tách riêng, hỗ trợ thêm/xóa/tạm dừng và ghim đúng sàn/cặp Spot.
- Coin mới không tự hết hạn; click mở trực tiếp chart 8H.
- Tab nguồn được giữ qua reload và khi quay lại từ chart.
- Theo dõi 7 ngày dùng `4H · 8H`, mặc định `4H`; các lựa chọn và giờ quét đọc từ `config.json`.
- v3.0.0 đã được nghiệm thu ở mức nền tảng Coin mới và chart 8H.
- v3.0.1-dev.1 đã pass checklist scheduler 8H, Telegram, chống gửi trùng, bỏ qua coin tạm dừng và hồi quy.
- v3.0.1-dev.1.2 bỏ chọn sàn khi thêm Coin mới, tự dò `Binance → OKX → Bybit`, đồng thời thiết kế lại form Coin mới và các hàng Lịch chạy; giao diện đã pass.
- v3.0.1-dev.1.3 sửa nút chạy Coin mới 8H trong phần Tự động, kiểm thử luồng dispatch scheduler và đưa thông số thời gian cố định vào `config.json`.
- v3.0.1 đã pass chạy tay và một mốc scheduler thực tế, được đóng chính thức để thay v2.9.2 trên production.

Phiên bản 2.1 đã có scheduler, cấu hình watchlist qua giao diện, gửi Telegram, chạy thử thủ công và chống gửi trùng. Chỉ bật lịch thật sau khi tín hiệu CEX/DEX đã được đối chiếu ổn định.

Phiên bản 2.2 đổi tên ứng dụng thành **Trading Signal**, thêm schema đa tài sản và các vùng cấu hình `stocks`, `stockDaily`, `stockWeekly`. Các vùng Stock vẫn tắt cho đến khi có adapter dữ liệu SSI và kiểm thử dữ liệu điều chỉnh.

Phiên bản 2.3 bổ sung đăng nhập quản trị, session cookie bảo mật, giới hạn đăng nhập sai, kiểm tra same-origin và khóa khởi động production nếu thiếu secret.

Phiên bản 2.4 cập nhật Pine `SMC SCAPLING` snapshot `b042e8f7…`, bổ sung TL1, TS, nhánh fake-rug còn thiếu và nhóm EXIT/TREND.

Phiên bản 2.7 hoàn thành SMC giai đoạn 1 trên chart CEX: Swing/Internal Structure, BOS, CHoCH và phân loại xu hướng. Phiên bản 2.8 hoàn thành giai đoạn 2 với Order Block, Fair Value Gap, Equal High/Low và công tắc riêng cho từng lớp; pivot H/L không còn được vẽ. Phiên bản 2.9 hoàn thành giai đoạn 3 với Premium, Discount và Equilibrium 50% dựa trên cặp swing đã xác nhận gần nhất. Engine chỉ phụ thuộc OHLC chuẩn hóa để tái sử dụng khi nối DEX chart và SSI Stock. Bước tiếp theo là kiểm chứng tín hiệu CEX trước khi bật Telegram vận hành thật.

## Scheduler

- D1: chạy sau khi nến UTC đóng và dữ liệu sàn cập nhật.
- W1: chạy sau khi tuần UTC đóng vào thứ Hai.
- Gọi lại các hàm scan hiện có; không viết lại indicator.
- Giới hạn tốc độ riêng cho GeckoTerminal/CoinGecko.

## Telegram Bot

- Cấu hình qua biến môi trường, không lưu token trong mã nguồn.
- Chỉ gửi BUY/SELL/BOTH; tùy chọn gửi bản tóm tắt NONE/ERROR.
- Nội dung gồm tài sản, nguồn/sàn, timeframe, loại tín hiệu, giá đóng, ngày nến và pool/contract nếu là DEX.
- Lưu khóa duy nhất `asset + timeframe + candleOpenTime + signal` để không gửi trùng.
- Có nút kiểm tra thủ công và hiển thị trạng thái lần chạy gần nhất.

## Cấu hình có thể thay đổi

- Watchlist CEX và DEX được nạp từ `.txt`, chỉnh trực tiếp và lưu lại trên giao diện.
- Giờ D1, ngày/giờ W1, Chat ID và tùy chọn báo lỗi/tóm tắt đều sửa được ở lần sau.
- Token bot luôn ở `.env`; giao diện không đọc ngược hoặc hiển thị token.

## Điều kiện bắt đầu

- Hoàn tất đối chiếu một tập tín hiệu BUY và SELL với TradingView.
- Nạp và lưu danh sách Watchlist thực tế.
- Cấu hình CoinGecko Analyst key nếu cần DEX W1.
- Người dùng tạo Telegram Bot và cung cấp token/chat ID qua biến môi trường trên máy chạy.
