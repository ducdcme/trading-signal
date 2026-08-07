# Trading Signal — Roadmap cập nhật

> Tài liệu roadmap chuẩn của dự án kể từ ngày 06/08/2026.  
> Baseline rollback: **v2.9.2**.  
> Bản chính thức đã nghiệm thu: **v3.0.1**.

## 1. Nguyên tắc phát triển đã khóa

- v2.9.1 được giữ nguyên làm mốc ổn định để rollback.
- Pine Script mới nhất là nguồn chuẩn khi đối chiếu tín hiệu.
- Chỉ dùng nến đã đóng để xác nhận tín hiệu; trình duyệt không tự tính lại tín hiệu.
- `SKIPPED` không được tính là `ERROR`.
- Telegram chỉ báo loại lỗi và số lượng; chi tiết lỗi chỉ ghi trong log server.
- Mọi thay đổi phải có test hồi quy và không làm hỏng chức năng CEX, SMC, Telegram hiện có.
- Chỉ nâng số phiên bản phát hành sau khi hoàn tất checklist nghiệm thu.
- Các bản `dev` được triển khai tại subdomain test; chỉ push bản chính thức sau khi người dùng nghiệm thu.

## 2. Trạng thái baseline v2.9.1

**Trạng thái: ✅ Hoàn thành và đang chạy production**

- Quét tín hiệu từ nến đã đóng; API trả OHLCV, EMA và tín hiệu.
- Chart CEX `1H · 4H · D1 · W1`, workspace nhiều coin và công cụ thao tác biểu đồ.
- SMC: Swing/Internal Structure, BOS/CHoCH, Order Block, FVG, EQH/EQL, Premium/Discount/Equilibrium.
- Danh sách theo dõi điểm vào 7 ngày trên khung nhỏ.
- Retry cùng sàn, fallback sàn dự phòng và giữ khóa chống gửi trùng.
- Telegram cảnh báo lỗi rút gọn; log server giữ chi tiết.
- Automated test **70/70 đạt**.
- Đối chiếu thủ công khoảng **20 mẫu** với TradingView: **đạt**.
- Đã push GitHub, triển khai và vận hành trên server.

### Tồn tại chuyển sang bản vá kế tiếp

- Trên điện thoại chưa thể zoom nến đủ rõ bằng thao tác hai ngón tay.

## 3. Hệ thống phiên bản tiếp theo

| Mốc | Nội dung | Trạng thái |
|---|---|---|
| v2.9.1 | Baseline CEX, chart, SMC, Telegram | ✅ Mốc rollback cũ |
| v2.9.2 | Sửa zoom và thao tác chart trên điện thoại | ✅ Đã nghiệm thu |
| v3.0.0 | Coin mới + nến 8H, dùng lại SMC/EMA/Signal | ✅ Nền tảng đã nghiệm thu, chưa thay production |
| v3.0.1 | Scheduler 8H + Telegram cho Coin mới | ✅ Đã nghiệm thu, sẵn sàng triển khai production |
| v3.1.0 | DEX khung nhỏ `1H · 4H · 8H` | ⏳ Chưa bắt đầu |
| v3.2.0 | Vàng–Bạc Việt Nam | ⏳ Chưa bắt đầu |

## 4. v2.9.2 — Mobile chart zoom

**Trạng thái: ✅ Hoàn thành và đã nghiệm thu trên subdomain test**

### Phạm vi

- Hỗ trợ chụm/mở hai ngón để thu/phóng số nến hiển thị.
- Zoom quanh vị trí giữa hai ngón để vùng đang xem không bị trôi khỏi màn hình.
- Kéo biểu đồ bằng một ngón tay.
- Không làm trang cuộn hoặc overscroll ngoài ý muốn khi thao tác trên canvas.
- Hoạt động ở cả chiều dọc và chiều ngang của điện thoại.
- Giữ nguyên zoom con lăn, kéo chuột và công cụ đo trên desktop.
- Không thay đổi thuật toán Signal, EMA, SMC, scanner, scheduler hoặc Telegram.

### Tiêu chí nghiệm thu

- [x] Tách phép tính pinch zoom thành module có thể kiểm thử.
- [x] Thêm thao tác pinch-to-zoom trên canvas.
- [x] Giữ thao tác kéo một ngón và hành vi desktop hiện tại.
- [x] Chặn overscroll trong vùng chart.
- [x] Automated test: **74/74 đạt**.
- [x] Kiểm tra cú pháp toàn bộ source: đạt.
- [x] Kiểm thử thực tế trên điện thoại.
- [x] Xác nhận nến có thể phóng đủ rõ.
- [x] Đóng ZIP chính thức làm mốc ổn định kế tiếp.
- [ ] Người dùng push GitHub và triển khai production theo lịch phù hợp.

## 5. v3.0.0 — Coin mới và biểu đồ 8H

**Trạng thái: ✅ Hoàn thành và đã nghiệm thu ngày 06/08/2026**

### Quyết định thiết kế

- Không xây State Engine 9 trạng thái.
- Không tạo bộ ngưỡng pump, dump, tạo nền hoặc breakout riêng.
- Dùng lại SMC, EMA và Signal hiện có để xác định xu hướng và điểm vào.
- Watchlist Coin mới tách riêng khỏi danh sách theo dõi 7 ngày.
- Coin chỉ bị xóa khi người dùng chủ động xóa; không tự hết hạn.

### Dữ liệu nến 8H

- Tạo một nến 8H từ đúng hai nến 4H đã đóng của cùng sàn/cặp.
- Không dùng nến 4H đang chạy.
- Không ghép dữ liệu từ nhiều sàn, nhiều cặp hoặc nhiều pool.
- Server tổng hợp nến và tính EMA/Signal/SMC; trình duyệt chỉ hiển thị.
- Có test cho ranh giới thời gian, nến thiếu, nến trùng và restart.

### Watchlist và biểu đồ

- Tab **Coin mới** riêng; hỗ trợ thêm, xóa và tạm dừng thủ công.
- Ghim cố định sàn và cặp cho từng coin.
- Click coin mở chart 8H; có thể chuyển sang 1H/4H để tìm điểm vào.
- Dùng lại workspace và các lớp SMC hiện có.

### Phạm vi phát hành

- v3.0.0 quản lý watchlist Coin mới và mở chart 8H để theo dõi thủ công.
- Scheduler/Telegram hiện có của CEX, DEX và Theo dõi 7 ngày được giữ nguyên.
- Scheduler 8H và Telegram riêng cho Coin mới được chuyển sang v3.0.1; không ghi nhận là chức năng của v3.0.0.

### Điều kiện hoàn thành v3.0.0

- [x] Ghép nến 8H đúng từ hai nến 4H đã đóng.
- [x] EMA, Signal và SMC hiện có chạy đúng trên nến 8H.
- [x] Watchlist Coin mới hỗ trợ thêm/xóa/tạm dừng và không tự hết hạn.
- [x] Chart 8H mở được từ danh sách Coin mới.
- [x] Giữ đúng tab khi reload/quay lại từ chart; không giữ kết quả quét cũ sau reload chủ động.
- [x] Theo dõi 7 ngày dùng `4H · 8H`, mặc định `4H`, cấu hình tập trung trong `config.json`.
- [x] Toàn bộ **90/90 test** đạt; kiểm tra cú pháp và kiểm thử thủ công đều đạt.
- [x] README, CHANGELOG và tài liệu vận hành được cập nhật trước phát hành.

### Các bản thử trên subdomain

| Bản | Phạm vi | Trạng thái |
|---|---|---|
| `v3.0.0-dev.1` | Ghép nến 8H từ 4H đã đóng; mở 8H trên chart CEX | ✅ Đã nghiệm thu trên subdomain |
| `v3.0.0-dev.1.1` | Click hai điểm để đo; sửa giờ nến 8H trên trục X | ✅ Đã nghiệm thu trên subdomain |
| `v3.0.0-dev.2` | Tab Coin mới; thêm/xóa/tạm dừng; ghim sàn/cặp | ✅ Chức năng đạt; chuyển lỗi UX sang bản vá |
| `v3.0.0-dev.2.1` | Giữ tab/điều hướng; bỏ kết quả cũ khi reload; Theo dõi 7 ngày dùng 4H/8H từ config | ✅ Đã nghiệm thu trên subdomain |
| `v3.0.0` | Hợp nhất, hồi quy, tài liệu và phát hành chính thức | ✅ Hoàn thành |

### v3.0.1 — Scheduler 8H và Telegram cho Coin mới

- Scheduler 8H cho Coin mới tại các mốc dự kiến `07:05 · 15:05 · 23:05` theo giờ Việt Nam.
- Chỉ quét khi nến 8H đã đóng và dữ liệu sẵn sàng.
- Dùng quy tắc Signal và chống gửi trùng hiện có.
- Telegram chỉ báo loại lỗi và số lượng; chi tiết exception tiếp tục chỉ ghi trong log server.

### Candidate `v3.0.1-dev.1.3`

- [x] Scheduler đọc lịch `07:05 · 15:05 · 23:05` từ `config.json`.
- [x] Chỉ dùng nến 8H hoàn chỉnh ghép từ hai nến 4H đã đóng.
- [x] Coin tạm dừng bị loại trước khi gọi API sàn.
- [x] Chống gửi trùng theo sàn, cặp, nến, chiều và loại tín hiệu.
- [x] Có nút chạy thủ công; chạy thủ công không ghi khóa chống trùng.
- [x] Telegram chỉ báo loại lỗi/số lượng; log server giữ exception chi tiết.
- [x] Automated test **103/103 đạt**, kiểm tra cú pháp và HTTP health đạt.
- [x] Checklist scheduler, Telegram và hồi quy của `dev.1` đã pass.
- [x] Bỏ chọn sàn; tự dò và ghim theo `Binance → OKX → Bybit`.
- [x] Thiết kế lại form Coin mới và các hàng Lịch chạy.
- [x] Chart 8H hiển thị nến đang chạy; Signal/scheduler vẫn chỉ dùng nến đóng.
- [x] Kiểm tra giao diện bản vá `dev.1.2` trên desktop và mobile.
- [x] Sửa nút chạy Coin mới 8H trong Automation để gọi thẳng cùng API với tab Coin mới.
- [x] Kiểm thử dispatch: master bật + lịch Coin mới bật + đúng giờ config mới tạo job `NEW_COIN`.
- [x] Đưa múi giờ và chu kỳ kiểm tra scheduler cố định vào `config.json`.
- [x] Kiểm tra nút chạy tay và xác nhận một mốc scheduler của bản `dev.1.3` trên subdomain.
- [x] Đóng bản `v3.0.1` chính thức.
- [ ] Người dùng push GitHub, pull về server và xác nhận health production.

## 6. v3.1.0 — DEX khung nhỏ

- Thêm token bằng `chain + contract address`.
- Cho phép chọn và ghim pool cụ thể.
- Hỗ trợ `1H · 4H · 8H`.
- Hiển thị thanh khoản; không nối dữ liệu từ hai pool.
- Cảnh báo khi cần chuyển pool và giới hạn số token quét để tránh quá tải API.
- Dùng chung chart, EMA, Signal và SMC đã ổn định.

## 7. v3.2.0 — Vàng–Bạc Việt Nam

- Tab **Vàng–Bạc**.
- Sản phẩm đầu tiên: Vàng miếng SJC, Nhẫn trơn 9999 và Bạc 999.
- Tách giá mua/bán; thu thập lịch sử và tổng hợp nến D1.
- Chart D1 với EMA và Signal sau khi nguồn dữ liệu đủ ổn định.

## 8. Bước thực hiện ngay

1. Push source `v3.0.1` chính thức lên GitHub.
2. Trên server, kiểm tra `git status --short`, sau đó `git pull --ff-only`.
3. Chạy `npm test`, `npm run check` và `pm2 reload trading-signal`.
4. Xác nhận `/api/health` trả `3.0.1` và kiểm tra log PM2.
5. Kiểm tra nhanh CEX, Theo dõi 7 ngày và một lượt Coin mới 8H sau triển khai.
