# Trading Signal — Roadmap cập nhật

> Tài liệu roadmap chuẩn của dự án kể từ ngày 05/08/2026.  
> Baseline production: **v2.9.1**.

## 1. Mục tiêu tài liệu

- Ghi nhận đúng trạng thái đã hoàn thành của v2.9.1.
- Loại bỏ xung đột số phiên bản giữa roadmap cũ và các bản nâng cấp biểu đồ/SMC đã phát hành.
- Chốt thứ tự triển khai từ **mục 3 — Coin mới 8H & State Engine**.
- Làm nguồn đối chiếu thống nhất cho phát triển, kiểm thử và phát hành các phiên bản tiếp theo.

## 2. Trạng thái dự án tại baseline v2.9.1

### Mục 1 — Hoàn thiện nền tảng CEX, biểu đồ và Telegram

**Trạng thái: ✅ Hoàn thành**

Các phần đã có trong production:

- Quét tín hiệu trên dữ liệu nến đã đóng.
- API lịch sử OHLCV và dữ liệu EMA/tín hiệu từ server; trình duyệt không tự tính lại tín hiệu.
- Biểu đồ CEX `1H · 4H · D1 · W1`, workspace nhiều coin và các công cụ thao tác biểu đồ.
- SMC gồm Swing/Internal Structure, BOS/CHoCH, Order Block, FVG, EQH/EQL và Premium/Discount/Equilibrium.
- Danh sách theo dõi điểm vào 7 ngày trên khung nhỏ.
- Retry cùng sàn, fallback sàn dự phòng và giữ khóa chống gửi trùng.
- Telegram chỉ báo loại lỗi và số lượng; chi tiết lỗi được ghi trong log server.
- Bộ kiểm thử tự động: **70/70 đạt**.
- Đã push GitHub, triển khai và chạy v2.9.1 trên server.

### Mục 2 — Đối chiếu TradingView và xác nhận baseline

**Trạng thái: ✅ Hoàn thành ngày 05/08/2026**

- Đã đối chiếu thủ công khoảng **20 mẫu** với TradingView.
- Kết quả đối chiếu: **đạt**.
- Đã xác nhận scanner và các khung nhỏ hoạt động ổn định trong kiểm thử thực tế.
- Pine Script mới nhất tiếp tục là nguồn chuẩn để đối chiếu tín hiệu.
- v2.9.1 được khóa làm baseline trước khi phát triển nhánh tính năng mới.

## 3. Điều chỉnh hệ thống phiên bản

Roadmap cũ dành `2.7.0` cho Coin mới 8H, `2.7.1` cho DEX khung nhỏ và `2.8.0` cho Vàng–Bạc. Tuy nhiên, các số phiên bản từ `2.7.0` đến `2.9.1` đã được dùng cho chuỗi nâng cấp biểu đồ và SMC.

Từ tài liệu này, các mốc được đổi như sau:

| Mục | Phiên bản mới | Nội dung | Trạng thái |
|---|---:|---|---|
| 1 | v2.9.1 | Nền tảng CEX, chart, SMC, Telegram và vận hành server | ✅ Hoàn thành |
| 2 | v2.9.1 | Đối chiếu TradingView, kiểm thử và khóa baseline | ✅ Hoàn thành |
| 3 | v3.0.0 | Coin mới 8H và State Engine | ▶️ Bắt đầu |
| 4 | v3.1.0 | DEX khung nhỏ `1H · 4H · 8H` | ⏳ Chưa bắt đầu |
| 5 | v3.2.0 | Vàng–Bạc Việt Nam | ⏳ Chưa bắt đầu |

## 4. Mục 3 — v3.0.0: Coin mới 8H & State Engine

**Trạng thái hiện tại: ▶️ Bắt đầu từ 05/08/2026**

### 3.1. Khóa đặc tả trước khi sửa code

- Xác định cấu trúc dữ liệu của một mục Coin mới.
- Chốt quy tắc ghép nến 8H và ranh giới thời gian của nến.
- Chốt điều kiện vào, giữ và rời từng trạng thái.
- Chốt các ngưỡng kỹ thuật: thanh khoản thấp, pump, dump, nền, breakout và thủng nền.
- Chốt dữ liệu trạng thái cần lưu để tiến trình khởi động lại không làm mất lịch sử.
- Chốt nguyên tắc Telegram chỉ phát khi trạng thái thực sự thay đổi.

**Đầu ra bắt buộc:** đặc tả state machine, bảng chuyển trạng thái và bộ dữ liệu mẫu trước khi triển khai engine.

### 3.2. Xây dựng dữ liệu nến 8H

- Tạo một nến 8H từ đúng **hai nến 4H đã đóng**.
- Không sử dụng nến 4H đang chạy để xác nhận nến 8H.
- Không tự ghép dữ liệu từ nhiều sàn hoặc nhiều cặp.
- Ghim cố định sàn và cặp cho từng coin trong watchlist.
- Dữ liệu chart và trạng thái được tính tại server; trình duyệt chỉ hiển thị.
- Có kiểm thử cho ranh giới thời gian, nến thiếu, nến trùng, dữ liệu cũ và tiến trình khởi động lại.

### 3.3. Xây dựng State Engine

Engine gồm chín trạng thái:

1. `COLLECTING_DATA`
2. `POST_DUMP`
3. `SEARCHING_BASE`
4. `BASE_FORMING`
5. `BASE_CONFIRMED`
6. `BREAKOUT_WATCH`
7. `BREAKOUT_CONFIRMED`
8. `BASE_FAILED`
9. `LOW_LIQUIDITY`

Yêu cầu:

- Mỗi lần chuyển trạng thái phải có điều kiện rõ ràng và lý do có thể ghi log.
- Cùng một nến đã xử lý không được gây chuyển trạng thái hoặc gửi Telegram lặp lại.
- Trạng thái phải được lưu bền vững và khôi phục đúng sau khi restart.
- Đủ **100 nến D1** chỉ tạo thông báo; không tự động chuyển trạng thái.
- LOW_LIQUIDITY không được che mất lỗi dữ liệu hoặc lỗi API.

### 3.4. Bộ dữ liệu giả lập và kiểm thử engine

Tạo các bộ nến độc lập cho:

- Pump–xả.
- Tiếp tục giảm.
- Tạo nền.
- Breakout giả.
- Breakout thật.
- Thủng nền.
- Thanh khoản thấp.
- Dữ liệu chưa đủ và dữ liệu bị gián đoạn.

Mỗi bộ dữ liệu phải xác nhận:

- Chuỗi trạng thái kỳ vọng.
- Thời điểm chuyển trạng thái.
- Không repaint sau khi nến đã đóng.
- Không gửi trùng khi chạy lại cùng dữ liệu.
- Khôi phục đúng sau restart.

### 3.5. Watchlist thủ công “Coin mới”

- Tạo tab **Coin mới** riêng.
- Thêm, xóa và tạm dừng coin bằng tay.
- Ghim cố định sàn và cặp.
- Danh sách không tự hết hạn.
- Lưu trạng thái hoạt động/tạm dừng và trạng thái engine hiện tại.
- Click coin mở biểu đồ 8H.
- Không trộn với danh sách theo dõi điểm vào 7 ngày hiện có.

### 3.6. Scheduler, Telegram và log

- Quét theo giờ Việt Nam: **07:05 · 15:05 · 23:05**.
- Chỉ xử lý khi nến 8H tương ứng đã đóng và dữ liệu đã sẵn sàng.
- Telegram chỉ gửi khi trạng thái thay đổi.
- Khóa chống gửi trùng tối thiểu phải gắn với coin, sàn/cặp, nến 8H và trạng thái mới.
- Telegram không gửi exception hoặc chi tiết lỗi; chỉ gửi loại lỗi và số lượng khi cần.
- Chi tiết chuyển trạng thái, dữ liệu nguồn và lỗi được ghi vào log server.

### 3.7. Biểu đồ 8H

- Dùng lại workspace biểu đồ hiện có.
- Hiển thị nến 8H đã tổng hợp tại server.
- Hiển thị trạng thái hiện tại và lịch sử chuyển trạng thái cần thiết để kiểm tra.
- Không tự tính lại state engine tại trình duyệt.
- Giữ nguyên nguyên tắc không phát tín hiệu từ nến đang chạy.

### 3.8. Điều kiện hoàn thành v3.0.0

v3.0.0 chỉ được coi là hoàn thành khi:

- [ ] Đặc tả và bảng chuyển trạng thái đã được chốt.
- [ ] Ghép nến 8H đúng từ hai nến 4H đã đóng.
- [ ] Chín trạng thái hoạt động đúng theo bộ test.
- [ ] Tất cả bộ dữ liệu giả lập đạt.
- [ ] Watchlist Coin mới hỗ trợ thêm/xóa/tạm dừng và không tự hết hạn.
- [ ] Scheduler chạy đúng ba mốc giờ.
- [ ] Telegram chỉ gửi khi chuyển trạng thái và không gửi trùng.
- [ ] Restart không làm mất hoặc lặp trạng thái.
- [ ] Biểu đồ 8H mở được từ danh sách Coin mới.
- [ ] Cảnh báo đủ 100 nến D1 không tự chuyển trạng thái.
- [ ] Toàn bộ test cũ của v2.9.1 vẫn đạt.
- [ ] Test mới đạt, kiểm tra cú pháp đạt và kiểm thử thủ công đạt.
- [ ] Cập nhật README, CHANGELOG và tài liệu vận hành trước khi phát hành.

## 5. Mục 4 — v3.1.0: DEX khung nhỏ

**Trạng thái: ⏳ Chưa bắt đầu**

- Thêm token bằng `chain + contract address`.
- Cho phép chọn và ghim pool cụ thể.
- Hỗ trợ `1H · 4H · 8H`.
- Hiển thị thanh khoản pool.
- Không tự nối dữ liệu từ hai pool.
- Cảnh báo khi cần chuyển pool.
- Giới hạn số token quét để tránh quá tải API.
- Dùng chung chart và các thành phần ổn định từ v3.0.0.

## 6. Mục 5 — v3.2.0: Vàng–Bạc Việt Nam

**Trạng thái: ⏳ Chưa bắt đầu; chỉ triển khai sau khi chốt nguồn dữ liệu**

### Nền tảng dữ liệu

- Tab **Vàng–Bạc**.
- Sản phẩm ban đầu: Vàng miếng SJC, Nhẫn trơn 9999 và Bạc 999.
- Tách giá mua và giá bán.
- Thu thập nhiều lần trong ngày, lưu lịch sử và tổng hợp nến D1.

### Biểu đồ và tín hiệu

- Biểu đồ nến D1.
- EMA21/EMA55 và tín hiệu theo nguồn chuẩn.
- Cho phép chuyển giữa giá mua và giá bán.
- Chỉ bật tín hiệu sau khi dữ liệu lịch sử đủ tin cậy.

## 7. Nguyên tắc phát triển áp dụng cho các mục tiếp theo

- v2.9.1 là baseline; không làm giảm độ ổn định của CEX hiện có.
- Pine Script mới nhất là nguồn chuẩn khi đối chiếu tín hiệu.
- Chỉ dùng nến đã đóng để xác nhận tín hiệu hoặc trạng thái.
- Dữ liệu và kết quả tính toán đến từ server; trình duyệt không tự tính lại.
- Không gửi nội dung lỗi chi tiết lên Telegram; chi tiết chỉ lưu trong log.
- `SKIPPED` không được tính là `ERROR`.
- Mọi tính năng mới phải có test hồi quy và không làm hỏng bộ test hiện tại.
- Không nâng số phiên bản phát hành nếu checklist nghiệm thu chưa hoàn thành.

## 8. Bước thực hiện ngay tiếp theo

Bắt đầu **mục 3.1 — khóa đặc tả State Engine**. Chưa sửa engine cho tới khi hoàn thành:

1. Schema dữ liệu Coin mới.
2. Quy tắc ghép nến 8H.
3. Bảng chín trạng thái và toàn bộ điều kiện chuyển.
4. Bộ dữ liệu giả lập cùng kết quả kỳ vọng.
5. Quy tắc lưu state, scheduler, chống gửi trùng và Telegram.

Sau khi duyệt đặc tả, triển khai theo thứ tự: **8H candle builder → state engine → test fixtures → watchlist/UI → scheduler/Telegram → chart 8H → kiểm thử phát hành**.
