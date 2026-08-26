# Changelog

## v3.3.0 — 2026-08-26
- Release VN Stock support: SSI/Vnstock data layer, PostgreSQL, dynamic universe, chart, watchlist and scanners.
- Add Stock D1 automation at 07:00 using latest closed D1 candle.
- Add Stock Telegram batching/dedup/restart hardening.
- Add multi-symbol and `.txt` stock preparation.
- Final UX: Stock tab defaults to Watchlist; compact Telegram batch headings.
- Full regression: 152/152 Trading Signal tests PASS; 40/40 Stocks Data Collector tests PASS.

## v3.3.0-dev.9 — UX patch before full regression
- Stock tab defaults to Watchlist-only display after reload.
- Add an explicit `Tất cả mã đã chuẩn bị` view for the PostgreSQL Stock universe.
- Telegram scheduled batch prints `Trading Signal` only once in the batch header.
- Compact batch section labels to COIN / VÀNG & BẠC / CHỨNG KHOÁN / DEX / COIN MỚI.

## v3.3.0-dev.8 — DEV 3 / Part 2 Patch 2
- Set default Stock D1 automation time to 07:00 for pre-market preparation.
- Manual and scheduled Stock D1 now share the same rule: scan the latest closed D1 candle.
- Remove scheduled Stock skip when Daily Sync fetches zero new candles.
- Migrate legacy default 15:30 to 07:00 while preserving custom Stock schedule times.

## v3.3.0-dev.7 — DEV 3 / Part 2 Patch 1
- Show Stock scheduler runtime states: RUNNING / OK / SKIPPED / ERROR.
- Explain no-fresh-D1 scheduled skips instead of looking like Stock did not run.
- Add Stock automation watchlist textarea and `.txt` import directly in Automation.
- Keep the VN Stock tab and Automation tab on the same persisted Stock watchlist.
- Add `Chuẩn bị mã thiếu + backfill` directly in Automation so Stock setup does not require tab switching.

## v3.3.0-dev.6 — DEV 3 / Part 2
- Harden shared scheduled Telegram batching.
- Share dedup keys across jobs in the same scheduler slot.
- Persist batch slot state to prevent duplicate replay after restart.
- Isolate failed automation groups while keeping successful groups in the batch.
- Keep technical error details out of Telegram.

## v3.3.0-dev.5 — DEV 3 / Part 1
- Add VN Stock D1 automation with Daily Sync before scan.
- Add Stock automation scopes and 15:30 weekday scheduler.
- Add manual Stock Telegram run and unified scheduled batching.
- Skip scheduled Stock scan when no fresh D1 candle exists.
- Add `.txt` import for bulk Stock symbols.

## 3.2.0 - 2026-08-22

- Phát hành chính thức thị trường **Vàng & Bạc**, đọc dữ liệu duy nhất qua API nội bộ của `metals-data-collector v0.3.1`.
- Hoàn thiện điều hướng phân tầng, bảng giá và chart D1/W1 cho ba sản phẩm Việt Nam cùng XAU/USD, XAG/USD và USD/VND.
- Hiển thị BUY/SELL riêng cho giá trong nước, MID cho dữ liệu thế giới; dựng nến biến động cho lịch sử Việt Nam một mẫu/ngày và giữ nguyên OHLC quan sát thật khi có đủ mẫu.
- Quy đổi XAU sang VND/lượng và XAG sang VND/kg theo USD/VND; tính premium/discount mua và bán cho Vàng miếng SJC, Nhẫn trơn 9999 và Bạc 999.
- Phát hành cảnh báo tự động D1 cho đúng ba sản phẩm Việt Nam và chỉ phía `SELL`; không cảnh báo BUY, XAU, XAG hoặc USD/VND.
- Chỉ dùng nến đã đóng, hỗ trợ chạy tay không ghi khóa, scheduler mặc định tắt, Telegram gộp và chỉ lưu khóa chống trùng sau khi gửi thành công.
- Đã nghiệm thu giao diện, chart, so sánh, chạy tay và scheduler trên VPS demo với dữ liệu mạng thực tế.
- Automated test: 134/134 đạt; kiểm tra cú pháp toàn bộ source đạt.

## 3.2.0-dev.6 - 2026-08-22

- Thêm cảnh báo tự động D1 cho đúng ba sản phẩm Việt Nam: Vàng miếng SJC, Nhẫn trơn 9999 và Bạc 999.
- Chỉ quét phía `SELL`; không quét `BUY`, XAU/USD, XAG/USD hoặc USD/VND.
- Scanner yêu cầu collector trả nến D1 đã đóng (`complete=true`) và dùng chung Signal hiện có.
- Thêm lịch Vàng–Bạc D1 mặc định tắt lúc `07:10` giờ Việt Nam để có thể gộp với bản tin Crypto D1.
- Thêm nút chạy tay **Chạy Vàng–Bạc SELL D1**, trạng thái lần chạy và báo cáo Telegram riêng.
- Khóa chống gửi trùng gồm sản phẩm, `SELL`, D1, thời gian nến và tín hiệu; chạy tay không ghi khóa.
- Các job trùng giờ tiếp tục gộp thành một bản tin; khóa chỉ được lưu sau khi bản tin gộp gửi thành công.
- Automated test: 134/134 đạt; kiểm tra cú pháp toàn bộ source đạt.

## 3.2.0-dev.5 - 2026-08-22

- Hoàn thiện tab **So sánh Việt Nam – Thế giới** bằng dữ liệu mới nhất từ `metals-data-collector v0.3.1`.
- Quy đổi XAU/USD sang VND/lượng và XAG/USD sang VND/kg theo USD/VND; không gọi thêm API bên ngoài.
- Tính riêng premium/discount theo giá mua và giá bán cho Vàng miếng SJC, Nhẫn trơn 9999 và Bạc 999.
- Hiển thị các đầu vào quy đổi, giá thế giới quy đổi, chênh lệch tuyệt đối và tỷ lệ phần trăm.
- Dữ liệu tham chiếu thiếu chỉ vô hiệu phần so sánh, không làm hỏng bảng giá hoặc biểu đồ Vàng & Bạc.
- Automated test: 128/128 đạt; kiểm tra cú pháp toàn bộ source đạt.

## 3.2.0-dev.4.1 - 2026-08-22

- Khôi phục điều hướng phân tầng đã chốt cho v3.2.0: bốn thị trường cấp 1 và các tab con riêng cho Crypto, Vàng & Bạc.
- Giữ nguyên kiến trúc mới: cả 6 mã trong nước và thế giới đều đọc từ `metals-data-collector v0.3.1`; không dùng Twelve Data.
- Tương thích URL cũ `#metals` bằng cách chuyển sang `#metals-overview`.
- Dựng nến biến động cho lịch sử Việt Nam có một mẫu/ngày: Open lấy Close ngày trước, High/Low lấy hai đầu Open/Close; OHLC có nhiều mẫu vẫn được giữ nguyên.
- Automated test: 126/126 đạt; kiểm tra cú pháp toàn bộ source đạt.

## 3.2.0-dev.4 - 2026-08-22

- Thêm tab **Vàng & Bạc** với 6 sản phẩm từ `metals-data-collector v0.3.1`.
- Trading Signal chỉ gọi API nội bộ tại `METALS_API_URL`; không phụ thuộc Twelve Data hoặc API kim loại bên ngoài.
- Hiển thị riêng BUY/SELL cho vàng và bạc Việt Nam; XAU/XAG/USDVND dùng MID.
- Thêm bridge `/api/metals/latest` và `/api/chart/metals`, có timeout và không mở trực tiếp collector ra Internet.
- Tái sử dụng chart, EMA, Signal và SMC hiện có cho D1/W1; chart Việt Nam cho phép đổi Giá mua/Giá bán.
- Thêm bộ lọc Tổng quan/Việt Nam/Thế giới và danh sách 6 sản phẩm bên phải chart.
- Automated test: 123/123 đạt; kiểm tra cú pháp toàn bộ source đạt.

## 3.1.0 - 2026-08-08

- Phát hành chính thức DEX scanner/chart `1H · 4H · 8H · D1`, chọn chain/contract/pool và workspace chart riêng.
- Hoàn thiện cảnh báo Telegram DEX `4H/8H` theo pool ghim và chống gửi trùng theo pool.
- Dùng một cấu hình độ trễ sau nến đóng cho Theo dõi, Coin mới 8H và DEX 4H/8H.
- Gộp mọi nhóm tự động đến hạn cùng thời điểm vào một bản tin Telegram duy nhất.
- Khi không có tín hiệu mới, bản tin tự động chỉ hiển thị thống kê lượt quét, không thêm câu “không có tín hiệu”.
- Chỉ ghi khóa chống gửi trùng sau khi bản tin gộp được gửi thành công.
- Automated test: 120/120 đạt; kiểm tra cú pháp toàn bộ source đạt.

## 3.1.0-dev.6 - 2026-08-08

- Bổ sung scheduler và Telegram riêng cho DEX `4H/8H`; lịch chạy sau các mốc nến đóng theo giờ Việt Nam và được cấu hình trong `config.json`.
- Thêm nút chạy tay **DEX 4H** và **DEX 8H** trong tab Tự động để nghiệm thu trước khi bật lịch.
- Cảnh báo DEX khung nhỏ bắt buộc ghim pool; nội dung Telegram ghi rõ chain, contract và pool đã dùng.
- Đưa `poolAddress` vào khóa chống gửi trùng để cùng token ở hai pool khác nhau không bị coi là một tín hiệu.
- Giữ chính sách Telegram chỉ báo loại/số lỗi; chi tiết exception chỉ ghi trong log server.
- Hai lịch DEX mặc định tắt khi nâng cấp; người dùng chủ động bật từng khung sau khi kiểm thử.
- Sửa import watchlist Automation để không làm mất pool address trong file `.txt`.
- Automated test: 119/119 đạt; kiểm tra cú pháp toàn bộ source đạt.

## 3.1.0-dev.5 - 2026-08-07

- Tách lượt quét nhiều token DEX thành các request tuần tự theo từng token, tránh một request tổng kéo dài vượt timeout reverse proxy; giao diện hiển thị tiến độ từng token.
- Lỗi riêng của một token không làm mất kết quả các token đã quét thành công trong cùng lượt.
- Danh sách chart DEX từ scanner được thay toàn bộ bằng lượt quét gần nhất, không cộng dồn token của các lượt trước.
- Tách riêng token thêm thủ công ngay trên chart; nhóm này tiếp tục được giữ qua các lượt quét và có thể xóa riêng.
- Reset dữ liệu workspace kiểu cũ của `dev.4` vì dữ liệu cũ chưa phân biệt token quét với token thêm thủ công.
- Giữ nguyên production `3.0.1`; candidate chỉ dùng trên subdomain test.
- Automated test: 114/114 đạt; kiểm tra cú pháp toàn bộ source đạt.

## 3.1.0-dev.4 - 2026-08-07

- Ẩn input file gốc khi giao diện đã có nút nhập `.txt` tùy biến ở CEX và DEX.
- Retry/backoff cả lỗi kết nối `fetch failed` và timeout, ngoài `429/5xx` đã hỗ trợ.
- Gộp request tải nến đang chạy; màn quét và chart dùng chung cache theo đúng pool.
- Khi nguồn DEX tạm lỗi, dùng cache nến gần nhất nếu vẫn đủ dữ liệu và hiển thị cảnh báo.
- Giữ nguyên production `3.0.1`; candidate chỉ dùng trên subdomain test.
- Automated test: 111/111 đạt; kiểm tra cú pháp toàn bộ source đạt.

## 3.1.0-dev.3 - 2026-08-07

- Cache kết quả tìm pool 30 phút và gộp các request tìm cùng chain/contract đang chạy để giảm số lần gọi GeckoTerminal.
- Tự retry lỗi `429` và `5xx` theo backoff; các giới hạn retry, thời gian chờ và cache pool nằm trong `config.json`.
- Quét và chart dùng lại pool/nến vừa tải khi dữ liệu đã đủ, giảm thời gian chờ sau bước chọn pool.
- Sửa chart DEX: danh sách token nằm ở cột phải như chart CEX, cho phép chuyển/xóa token và thêm trực tiếp theo luồng chọn chain → dán contract → tìm/chọn pool; chỉ xếp xuống dưới trên màn hình mobile.
- Lưu workspace DEX riêng trong trình duyệt, giữ một pool đã chọn cho mỗi chain + contract và không trộn với danh sách CEX.
- Automated test: 109/109 đạt; kiểm tra cú pháp toàn bộ source đạt.

## 3.1.0-dev.2 - 2026-08-07

- Đổi form DEX sang chọn chain từ dropdown, dán contract address, xem danh sách pool rồi chủ động chọn/ghim.
- Danh sách pool hiển thị cặp, DEX, địa chỉ pool, thanh khoản và volume 24h; pool dưới ngưỡng vẫn được phép chọn thủ công.
- Bỏ giới hạn quote pair USDT/USDC; cơ chế tương thích khi chưa ghim pool chọn pool đủ ngưỡng có thanh khoản cao nhất.
- Hạ `minimumLiquidityUsd` mặc định từ 100.000 USD xuống 10.000 USD.
- Bổ sung scanner và chart DEX khung D1; giữ nguyên quy tắc Signal/SMC chỉ xác nhận bằng nến đã đóng.
- Automated test: 107/107 đạt; kiểm tra cú pháp toàn bộ source đạt.

## 3.1.0-dev.1 - 2026-08-07

- Nâng tab DEX sang các khung nhỏ `1H · 4H · 8H`; 8H được ghép từ đúng hai nến 4H của cùng pool.
- Cho phép nhập `chain:token_address:pool_address` để ghim pool; nếu bỏ trống pool, server tự chọn pool USDT/USDC phù hợp.
- Không nối dữ liệu từ nhiều pool; pool ghim được giữ nguyên ngay cả khi có pool thanh khoản cao hơn và chỉ phát cảnh báo đề xuất.
- Hiển thị thanh khoản, loại pool ghim/tự chọn, contract và pool address trong kết quả.
- Thêm chart DEX dùng chung EMA, Signal, SMC và hỗ trợ nến đang chạy; tín hiệu vẫn chỉ tính trên nến đã đóng.
- Đưa khung DEX, giới hạn token, số nến, số trang pool, concurrency và tỷ lệ cảnh báo chuyển pool vào `config.json`.
- Mặc định tối đa 10 token/lượt, quét tuần tự và đọc một trang pool để giảm tải GeckoTerminal.
- Automated test: 106/106 đạt; kiểm tra cú pháp, lượt quét Solana 4H và chart DEX 8H thực tế đạt.

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
