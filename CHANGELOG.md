# Changelog

## 3.0.1 - 2026-08-07

- Phát hành chính thức scheduler và Telegram cho Coin mới trên nến `8H` đã đóng tại `07:05 · 15:05 · 23:05` giờ Việt Nam.
- Tự dò và ghim cặp Spot theo thứ tự `Binance → OKX → Bybit`; coin tạm dừng bị loại trước khi gọi API sàn.
- Chống gửi trùng theo sàn, cặp, nến, chiều và loại tín hiệu; chạy thủ công không ghi khóa của scheduler.
- Telegram chỉ báo loại lỗi và số lượng; chi tiết exception chỉ ghi trong log server.
- Chart 8H hiển thị nến đang chạy, trong khi Signal và scheduler vẫn chỉ dùng nến đã đóng.
- Hoàn tất sửa giao diện Coin mới, các hàng Automation và nút chạy Coin mới 8H trong phần Tự động.
- Giữ nguyên cấu hình production về `.env.example`, port, PM2 và Nginx.
- Automated test: 103/103 đạt; kiểm tra cú pháp, HTTP health và kiểm thử thực tế trên subdomain đạt.

## 3.0.1-dev.1.3 - 2026-08-07

- Sửa nút **Chạy Coin mới 8H** trong phần Tự động: gọi trực tiếp cùng API quét đã hoạt động ở tab Coin mới, không còn bị chặn bởi bước lưu toàn bộ form Automation.
- Tách kế hoạch dispatch scheduler thành mô-đun kiểm thử được; xác nhận job Coin mới chỉ được gọi khi master Automation bật, lịch Coin mới bật và đúng mốc giờ cấu hình.
- Chuyển múi giờ cố định và chu kỳ kiểm tra scheduler vào `config.json`; lịch Coin mới tiếp tục đọc `scanHours` và `scanMinute` từ file này.
- Không thay đổi Signal, Telegram, chống gửi trùng, nến 8H hoặc cấu hình port/PM2/Nginx.
- Automated test: 103/103 đạt; kiểm tra cú pháp đạt.

## 3.0.1-dev.1.2 - 2026-08-07

- Bỏ trường chọn sàn ở tab Coin mới; chỉ cần nhập mã coin hoặc cặp Spot.
- Tự dò và ghim thị trường đầu tiên theo thứ tự cấu hình `Binance → OKX → Bybit`; nếu nhập rõ quote như `USDC`, hệ thống giữ đúng quote đó.
- Thiết kế lại lưới form Coin mới và toàn bộ hàng Lịch chạy để căn thẳng trên desktop, tablet và mobile.
- Biểu đồ 8H hiển thị nến đang chạy giống D1; Signal và scheduler vẫn chỉ dùng nến đã đóng.
- Giữ nguyên dữ liệu Coin mới cũ, scheduler 8H, Telegram, chống gửi trùng và cấu hình production.
- Automated test: 100/100 đạt; kiểm tra cú pháp đạt.

## 3.0.1-dev.1.1 - 2026-08-06

- Sửa trường `Cặp Spot` bị đội lên do kế thừa `margin-bottom` của input chung; nhãn và ô nhập giờ thẳng hàng với trường `Sàn`.
- Giữ nguyên toàn bộ scheduler, Telegram, chống gửi trùng và cấu hình production của `3.0.1-dev.1` đã kiểm thử.
- Automated test: 95/95 đạt; kiểm tra cú pháp đạt.

## 3.0.1-dev.1 - 2026-08-06

- Thêm scheduler riêng cho watchlist Coin mới trên nến `8H` đã đóng tại `07:05 · 15:05 · 23:05` giờ Việt Nam.
- Dùng lại Signal và khóa chống gửi trùng hiện có; khóa gồm đúng sàn, cặp, nến, chiều và loại tín hiệu.
- Bỏ coin tạm dừng trước khi gọi API sàn; không tự đổi sang sàn khác đối với cặp đã ghim.
- Thêm nút quét Coin mới 8H thủ công để kiểm thử Telegram ngay.
- Telegram chỉ hiển thị loại lỗi và số lượng; chi tiết exception tiếp tục chỉ ghi log server.
- Lịch 8H được tập trung trong `config.json`; cấu hình Automation được nâng tương thích lên schema v4.
- Ngưỡng Coin mới là 61 nến 8H (khoảng 20 ngày), đủ cho EMA55/Signal; scanner cũ vẫn giữ ngưỡng 100 nến.
- Automated test: 95/95 đạt; kiểm tra cú pháp và HTTP health đạt.

## 3.0.0 - 2026-08-06

- Phát hành chính thức khung `8H`, được tổng hợp từ đúng hai nến `4H` đã đóng của cùng sàn/cặp.
- Dùng lại EMA, Signal và SMC hiện có trên nến 8H; hiển thị đúng giờ mở nến theo GMT+7.
- Thêm tab Coin mới với watchlist riêng, ghim sàn/cặp Spot, thêm/xóa/tạm dừng và không tự hết hạn.
- Giữ đúng tab khi reload hoặc quay lại từ chart; reload chủ động không phục hồi kết quả quét CEX/DEX cũ.
- Đổi Theo dõi 7 ngày sang `4H · 8H`, mặc định `4H`, và đưa cấu hình liên quan vào `config.json`.
- Đổi phép đo chart sang `Shift + click` tại điểm đầu rồi click tại điểm cuối; `Esc` vẫn xóa phép đo.
- Chưa bật scheduler/Telegram riêng cho Coin mới; hạng mục này được chuyển sang mốc tiếp theo.

## 3.0.0-dev.2.1 - 2026-08-06

- Giữ tab đang chọn qua reload; chart mở từ Coin mới hoặc Theo dõi 7 ngày quay lại đúng tab nguồn.
- Kết quả quét CEX/DEX chỉ được phục hồi khi điều hướng sang chart rồi quay lại; reload chủ động sẽ xóa kết quả cũ.
- Đổi Theo dõi 7 ngày sang khung `4H · 8H`, mặc định `4H`; dữ liệu `1H` cũ được chuyển an toàn sang mặc định mới.
- Đưa khung cho phép, khung mặc định, số ngày giữ và các giờ quét vào `config.json`.
- Khung theo dõi `8H` lấy nến nguồn `4H` và dùng lại engine tổng hợp 8H đã kiểm thử.

## 3.0.0-dev.2 - 2026-08-06

- Thêm tab Coin mới và watchlist lưu riêng trong `DATA_DIR/new-coin-watchlist.json`.
- Cho phép thêm thủ công, tạm dừng/tiếp tục và xóa; coin không tự hết hạn.
- Bắt buộc chọn sàn cụ thể, kiểm tra cặp Spot đang giao dịch và ghim cố định đúng sàn/cặp.
- Chặn thêm trùng cùng một định danh `sàn:cặp`.
- Click coin mở trực tiếp chart 8H; vẫn có thể chuyển sang 1H và 4H để tìm điểm vào.
- Chưa thêm scheduler hoặc Telegram 8H; các phần này được giữ cho dev.3.

## 3.0.0-dev.1.1 - 2026-08-06

- Đổi phép đo từ `Shift + kéo` sang `Shift + click` để đặt điểm đầu và click lần hai để đặt điểm cuối.
- Cho phép thả phím Shift ngay sau điểm đầu; phép đo vẫn theo con trỏ cho tới click hoàn tất.
- Giữ phím `Esc` để xóa phép đo và không thay đổi thao tác kéo/zoom biểu đồ.
- Sửa nhãn trục X của khung 8H để hiển thị cả ngày và giờ mở nến theo GMT+7.

## 3.0.0-dev.1 - 2026-08-06

- Thêm tổng hợp nến 8H từ đúng hai nến 4H đã đóng theo ranh giới UTC.
- Bỏ qua bucket 8H nếu thiếu nến, trùng open time hoặc còn nến 4H đang chạy.
- Thêm khung 8H vào API và workspace chart CEX.
- Chưa thêm watchlist Coin mới, scheduler hoặc Telegram 8H trong bản dev này.

## 2.9.2 - 2026-08-06

- Thêm thao tác chụm/mở hai ngón để zoom số nến hiển thị trên điện thoại.
- Giữ điểm neo zoom theo vị trí giữa hai ngón tay để khu vực đang xem không bị trôi khỏi màn hình.
- Giữ thao tác kéo biểu đồ bằng một ngón và zoom con lăn trên máy tính như v2.9.1.
- Chặn cuộn/overscroll trang ngoài ý muốn khi thao tác trực tiếp trên canvas.
- Thêm kiểm thử đơn vị cho phép tính khoảng cách, trung điểm, tỷ lệ neo và mức zoom cảm ứng.

## 2.9.1 - 2026-08-05

- Job theo dõi khung nhỏ tự thử lại cùng sàn hai lần khi timeout, lỗi mạng, `429` hoặc `5xx`.
- Nếu sàn nguồn vẫn lỗi, tiếp tục tìm cặp Spot trên các sàn dự phòng và hiển thị đúng nguồn dữ liệu thực tế.
- Giữ khóa chống gửi trùng theo mục theo dõi ban đầu, kể cả khi lần quét phải dùng sàn dự phòng.
- Lỗi riêng lẻ chỉ ghi log; Telegram chỉ nhận cảnh báo kỹ thuật khi toàn bộ lượt quét thất bại.
- Telegram chỉ hiển thị loại lỗi và số lượng; chi tiết mã/sàn/exception cùng các lần fallback thành công được giữ trong log server.
- Bật EQH/EQL mặc định và di chuyển an toàn các tùy chọn SMC đã lưu từ v2.9.0.

## 2.9.0 - 2026-08-05

- Thêm Premium, Discount và Equilibrium 50% theo dealing range của cấu trúc Swing hiện tại.
- Chỉ dùng cặp Swing High/Low đã xác nhận gần nhất theo hướng cấu trúc; không dùng nến đang chạy.
- Tách ba công tắc hiển thị riêng, đều mặc định tắt và lưu tùy chọn trong trình duyệt.
- Hiển thị vùng nền rất nhạt để giữ chart thoáng; các vùng chỉ làm bối cảnh, không tạo tín hiệu Telegram độc lập.

## 2.8.0 - 2026-08-05

- Bỏ toàn bộ nhãn pivot `H/L` khỏi chart; pivot chỉ còn dùng nội bộ để tính cấu trúc.
- Làm mờ nhãn `BOS/CHoCH` và dùng đường gạch/chấm mảnh để giảm nhiễu biểu đồ.
- Tách công tắc riêng cho Swing Structure, Internal Structure, Order Block, FVG và EQH/EQL; chỉ Swing Structure bật mặc định.
- Thêm Order Block từ nến đối ứng cuối cùng trước điểm phá cấu trúc, kèm trạng thái còn hiệu lực/đã vô hiệu.
- Thêm Fair Value Gap theo mô hình ba nến và theo dõi thời điểm khoảng trống được lấp đầy.
- Thêm Equal High/Equal Low với ngưỡng thích nghi theo ATR để dùng ổn định trên nhiều thang giá.
- Giới hạn số vùng SMC gần nhất được vẽ để giữ hiệu năng và độ thoáng của chart.

## 2.7.0 - 2026-08-05

- Thêm SMC giai đoạn 1 dưới dạng module độc lập, dùng chung được cho CEX, DEX và Stock sau này.
- Xác định Swing High/Low bằng pivot 5–5 và Internal High/Low bằng pivot 2–2.
- Hiển thị BOS cùng hướng và CHoCH khi cấu trúc đảo hướng; bullish màu xanh, bearish màu đỏ.
- Chỉ xác nhận phá cấu trúc bằng giá đóng cửa của nến đã đóng, không dùng nến đang chạy và không repaint pivot trước khi đủ nến bên phải.
- Thêm công tắc SMC, bộ chọn Swing/Internal/Cả hai và huy hiệu xu hướng hiện tại; lưu tùy chọn trong trình duyệt.

## 2.6.8 - 2026-08-05

- Giữ Shift và kéo chuột trong vùng nến để đo chênh lệch giá, phần trăm thay đổi và số nến.
- Hiển thị vùng đo màu xanh khi giá tăng, màu đỏ khi giá giảm.
- Giữ kết quả đo sau khi thả chuột và cho phép xóa bằng phím Escape.
- Tách thao tác đo khỏi kéo biểu đồ và co giãn trục giá để tránh xung đột chuột.

## 2.6.7 - 2026-08-05

- Cô lập lỗi API theo từng sàn trong chế độ AUTO: OKX lỗi không còn chặn Bybit, Bitget, KuCoin, Gate.io và MEXC phía sau.
- Dùng chung hàng đợi và retry `429` cho cả catalog Spot lẫn lịch sử nến OKX.
- Hiển thị nhãn thời gian và crosshair chart theo `Asia/Ho_Chi_Minh` (GMT+7), định dạng 24 giờ.
- Giữ nguyên timestamp UTC trong dữ liệu và logic tín hiệu; chỉ quy đổi múi giờ tại lớp hiển thị.

## 2.6.6 - 2026-08-05

- Thay con trỏ bàn tay mặc định trên biểu đồ bằng crosshair giống TradingView.
- Hiển thị đường gióng dọc theo thời gian và đường gióng ngang theo giá, kèm nhãn trên trục X/Y.
- Bỏ tooltip OHLC/EMA/tín hiệu cạnh con trỏ để không che nến.
- Giữ nguyên chế độ kéo biểu đồ và co giãn trục Y của v2.6.5.

## 2.6.5 - 2026-08-05

- Chuyển toàn bộ danh sách coin hợp lệ từ bảng quét sang workspace biểu đồ.
- Thêm sidebar hiển thị cặp giao dịch, giá hiện tại và thay đổi so với giá đóng cửa D1 trước.
- Cho phép đổi coin ngay tại trang chart mà không phải quay lại danh sách.
- Cho phép nhập mã, tự tìm cặp Spot, thêm và xóa coin khỏi danh sách chart riêng.
- Lưu workspace trong trình duyệt và giữ nguyên khung thời gian khi chuyển coin hoặc tải lại trang.
- Thêm API quote nhẹ, cache 15 giây, giới hạn đồng thời và tạm dừng cập nhật khi tab không hoạt động.

## 2.6.4 - 2026-08-05

- Mỗi nhóm BUY hoặc SELL trên cùng một nến chỉ vẽ một mũi tên.
- Giữ đầy đủ mọi mã tín hiệu và xếp thành cột phía ngoài mũi tên để tránh lặp biểu tượng.

## 2.6.3 - 2026-08-05

- Cho phép kéo biểu đồ sang vùng tương lai tối đa khoảng một nửa khung nhìn; vẫn giữ mặc định 20 ô trống bên phải.
- Vẽ thêm nến hiện tại đang chạy đến thời điểm mở chart, nhưng không phát tín hiệu chưa xác nhận trên nến này.
- Giảm nét EMA xu hướng xuống 1 px để không che nến.
- Xếp riêng từng tín hiệu BUY/SELL trên cùng một nến với khoảng cách cố định để không chồng chữ.
- Viết gọn `Exit Short` thành `extS` và `Exit Long` thành `extL` trên biểu đồ.
- Giữ kết quả quét CEX/DEX trong phiên trình duyệt và tự khôi phục khi quay lại danh sách từ trang chart.
- Nút quay lại danh sách ưu tiên lịch sử trình duyệt để giữ trạng thái và vị trí trang.

## 2.6.2 - 2026-08-05

- Lăn chuột ở mọi vị trí trên biểu đồ chỉ phóng/thu trục X quanh con trỏ.
- Giữ chuột trái trong vùng nến để kéo biểu đồ theo cả chiều ngang và chiều dọc.
- Chỉ co giãn trục Y khi giữ và kéo trực tiếp trên vùng giá bên phải.
- Hợp nhất xử lý kéo chuột và cảm ứng bằng Pointer Events để thao tác ổn định hơn.
- Chừa 20 ô nến tương lai bên phải; trên D1 tương ứng 20 ngày sau nến mới nhất.

## 2.6.1 - 2026-08-05

- Cho phép kéo lên/xuống trực tiếp trên trục giá bên phải để co giãn trục Y.
- Hỗ trợ con lăn chuột trên trục giá và thao tác kéo trên màn hình cảm ứng.
- Nhấp đúp trục giá hoặc bấm `Trục Y: Tự động` để khôi phục autoscale.
- Tự khôi phục autoscale khi đổi khung thời gian hoặc số lượng nến hiển thị.
- Cho phép kéo vùng nến theo chiều ngang để xem lịch sử và chiều dọc để đưa vùng giá vào tâm.
- Cho phép lăn chuột trong vùng nến để zoom trục thời gian quanh vị trí con trỏ.
- Chỉ vẽ một đường EMA21; màu xanh khi EMA21 trên EMA55 (uptrend), màu đỏ khi EMA55 trên EMA21 (downtrend).

## 2.6.0 - 2026-08-05

- Thêm API lịch sử nến CEX cho `1H`, `4H`, `1D`, `1W`, chỉ dùng nến đã đóng.
- Thêm trang biểu đồ nến Nhật với EMA21/EMA55, tooltip và tín hiệu Pine trên từng nến.
- Cho phép mở biểu đồ từ bảng quét CEX và danh sách theo dõi 7 ngày.
- Chuẩn hóa `Exit Short` thành cảnh báo BUY và `Exit Long` thành cảnh báo SELL.
- Không gửi chi tiết lỗi lấy dữ liệu lên Telegram; chỉ ghi log và báo tổng số lỗi/bỏ qua.

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
# 3.0.0-dev.1

- Thêm tổng hợp nến 8H từ đúng hai nến 4H đã đóng theo ranh giới UTC.
- Bỏ qua bucket 8H nếu thiếu nến, trùng open time hoặc còn nến 4H đang chạy.
- Thêm khung 8H vào API và workspace chart CEX.
- Chưa thêm watchlist Coin mới, scheduler hoặc Telegram 8H trong bản dev này.
