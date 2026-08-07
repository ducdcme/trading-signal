# Trading Signal

Phiên bản chính thức: **3.0.1**. Bản này bổ sung scheduler và Telegram cho Coin mới 8H, hoàn tất thao tác chạy tay trong phần Tự động và kiểm thử dispatch scheduler thực tế. Biểu đồ nến Nhật, EMA, Signal và SMC tiếp tục dùng chung engine hiện có trên `1H`, `4H`, `8H`, `D1`, `W1`; không thay đổi các cấu hình production về port, PM2, Nginx hoặc `.env.example`.

Ứng dụng quét tín hiệu đa tài sản trên dữ liệu nến đã đóng. Hiện tại CEX Crypto và DEX Crypto hoạt động; kiến trúc đã dành sẵn provider, watchlist và lịch riêng cho chứng khoán Việt Nam.

## Chạy trên Windows

Yêu cầu Node.js 18 trở lên. Mở Terminal tại thư mục dự án:

```powershell
Copy-Item .env.example .env
npm start
```

Mở file `.env`, điền các API key cần dùng rồi truy cập <http://localhost:3210>. Không cần `npm install` vì bản đầu không dùng thư viện ngoài. Server tự đọc `.env` khi khởi động và biến môi trường đã đặt trên hệ điều hành luôn được ưu tiên hơn giá trị trong file.

Các biến có sẵn trong `.env.example`:

- `PORT`: cổng chạy web, mặc định `3210`.
- `HOST`: mặc định `127.0.0.1`, chỉ cho phép truy cập từ máy chạy tool.
- `DATA_DIR`: thư mục lưu watchlist, lịch chạy và trạng thái chống gửi trùng. Trên server nên đặt ngoài thư mục source.
- `COINGECKO_API_KEY`: đang được dùng cho DEX W1.
- `SSI_API_KEY`, `SSI_API_SECRET`: chuẩn bị cho tab VN Stocks, chưa được dùng.
- `TELEGRAM_BOT_TOKEN`: token lấy từ BotFather, đang dùng để gửi cảnh báo.
- `TELEGRAM_CHAT_ID`: có thể điền sẵn hoặc để trống rồi dùng nút **Tìm Chat ID** trên giao diện.
- `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, `AUTH_SESSION_SECRET`: bắt buộc khi chạy production; tạo bằng `npm run generate-auth`.
- `AUTH_SESSION_HOURS`: thời hạn phiên đăng nhập, mặc định 12 giờ.

Không đưa file `.env` lên Git và không gửi API key qua chat. File này đã được thêm vào `.gitignore`.

## Bảo mật đăng nhập

Tạo tài khoản quản trị trong Terminal:

```powershell
npm run generate-auth
```

Nhập tên đăng nhập và mật khẩu tối thiểu 12 ký tự. Lệnh sẽ tạo bốn dòng `AUTH_*`; sao chép chúng vào `.env` rồi khởi động lại ứng dụng. Mật khẩu không được lưu trực tiếp.

Khi `NODE_ENV=production`, ứng dụng từ chối khởi động nếu thiếu cấu hình xác thực. Phiên đăng nhập dùng cookie HttpOnly, SameSite Strict và Secure; vì vậy domain production phải có HTTPS. Đăng nhập sai nhiều lần sẽ bị khóa tạm thời.

## Thêm coin

Có ba cách thêm coin:

1. Nhập file Watchlist `.txt` xuất từ TradingView. Tool hỗ trợ dạng `BINANCE:BTCUSDT,BINANCE:ETHUSDT` và dạng mỗi mã một dòng.
2. Nhập hoặc bổ sung coin trực tiếp trong ô danh sách trên giao diện.
3. Sửa `symbols` trong `config.json`:

```json
"symbols": ["BTC", "ETH", "BNB", "SOL", "FLUX", "GTC", "ATOM", "MNT", "PI"]
```

Chỉ cần nhập tên coin, ví dụ `MNT` hoặc `PI`. Tool ưu tiên quote `USDT`, sau đó `USDC`; riêng Binance thử thêm `FDUSD`:

1. Binance
2. OKX
3. Bybit
4. Bitget
5. KuCoin
6. Gate.io
7. MEXC

Mỗi coin chỉ được giữ một lần. Hệ thống tải catalog Spot đang giao dịch của từng sàn, chọn cặp đầu tiên theo thứ tự sàn và quote rồi mới lấy nến. Cặp đã delist không được chọn dù API vẫn còn trả nến lịch sử. Nếu nến cuối cũ quá hai chu kỳ, hệ thống loại kết quả thay vì phát tín hiệu từ dữ liệu chết. Trong chế độ tự chọn sàn (`AUTO`), lỗi catalog hoặc API nến của một sàn được ghi nhận và resolver tiếp tục thử sàn phía sau; kết quả cuối vẫn chỉ dùng đúng một sàn và hiển thị nguồn thực tế. Khi người dùng ghim sàn cụ thể trên chart hoặc danh sách theo dõi, API lỗi vẫn được báo trực tiếp và không tự đổi nguồn. Có thể đổi thứ tự trong `exchangePriority` của `config.json`.

Tiền tố sàn trong file TradingView được bỏ khi nạp để hệ thống luôn áp dụng `exchangePriority`. Danh sách theo dõi 7 ngày vẫn giữ đúng sàn và cặp đã được chọn tại thời điểm bạn thêm thủ công.

Các API đều là API dữ liệu thị trường công khai, không cần API key:

- Binance: `/api/v3/klines`
- OKX V5: `/api/v5/market/history-candles`
- Bybit V5: `/v5/market/kline`, `category=spot`
- Bitget V2: `/api/v2/spot/market/candles`
- KuCoin: `/api/v1/market/candles`
- Gate.io V4: `/api/v4/spot/candlesticks`
- MEXC V3: `/api/v3/klines`

Quyền truy cập Bybit hoặc OKX có thể phụ thuộc mạng và khu vực của máy đang chạy tool. Khi một API bị chặn, kết quả sẽ ghi rõ lỗi của từng sàn đã thử.

Khi chọn file `.txt`, danh sách trong file sẽ thay nội dung ô nhập. Sau đó vẫn có thể sửa, xóa hoặc thêm coin mới trước khi bấm **Quét tín hiệu**. File chỉ được đọc trong trình duyệt và không được tải lên máy chủ khác.

Có thể thử ngay bằng file `sample-watchlist.txt` đi kèm dự án.

## Theo dõi điểm vào 7 ngày

Scanner D1 chỉ phát hiện và hiển thị tín hiệu; không tự đưa mọi tín hiệu vào danh sách theo dõi. Sau khi tự đánh giá, bấm **+ BUY** hoặc **+ SELL** tại đúng dòng D1 cần quan sát. Khung mặc định là `4H` và có thể đổi sang `8H` trước khi thêm.

- D1 BUY chỉ tìm tín hiệu BUY trên khung nhỏ.
- D1 SELL chỉ tìm tín hiệu SELL trên khung nhỏ.
- Ưu tiên đúng sàn đã được chọn ở D1; nếu timeout, `429`, `5xx` hoặc lỗi mạng thì thử lại hai lần trước khi chuyển sang sàn dự phòng.
- Mỗi coin chỉ có một mục theo dõi; thêm lại sẽ cập nhật chiều, khung và bắt đầu lại 7 ngày.
- Hết 7 ngày mục tự ngừng quét; có thể gia hạn hoặc xóa thủ công.
- Scheduler mặc định quét lúc `03:05 · 07:05 · 11:05 · 15:05 · 19:05 · 23:05` theo giờ Việt Nam và chỉ gửi khi nến đã đóng có tín hiệu đúng chiều.

Danh sách nằm tại `DATA_DIR/focus-watchlist.json`, tách khỏi source và không bị ảnh hưởng khi cập nhật bằng Git. Các mục `timeframes`, `defaultTimeframe`, `retentionDays` và `scanHours` nằm trong vùng `focus` của `config.json`; thay đổi file này cần restart tiến trình.

## DEX Crypto

DEX không tìm theo ticker. Mỗi dòng bắt buộc có blockchain và `token_address`:

```text
solana:ĐỊA_CHỈ_TOKEN
base:0xĐỊA_CHỈ_TOKEN
bsc:0xĐỊA_CHỈ_TOKEN
```

Các network mặc định: `solana`, `eth`, `base`, `bsc`, `arbitrum`, `polygon_pos`, `avax`, `optimism`.

Có thể dùng `sample-dex-watchlist.txt` đi kèm để kiểm tra tab DEX.

Tool dùng GeckoTerminal để lấy tối đa ba trang pool, chỉ giữ pool có thanh khoản tối thiểu 100.000 USD, ưu tiên pool USDT rồi fallback USDC, sau đó chọn pool thanh khoản lớn nhất trong loại quote được ưu tiên. Pool ghép token khác bị loại.

- D1: dùng GeckoTerminal keyless, không cần API key.
- W1: tổng hợp từ tối thiểu 700 nến ngày và cần CoinGecko Onchain **Analyst** API key để lấy lịch sử sâu.

Cấu hình W1 trong file `.env`:

```dotenv
COINGECKO_API_KEY=YOUR_KEY
```

Không ghi API key vào `config.json` hoặc commit lên Git.

## VN Stocks

Tab giao diện đã được chuẩn bị. Dữ liệu dự kiến dùng SSI FastConnect Data; cần API Key/Secret SSI. Kết nối sẽ được thực hiện sau khi CEX và DEX được đối chiếu ổn định.

## Kiến trúc

Tool không tự động điều khiển TradingView. Công thức Pine đã được chuyển sang JavaScript và chạy trên dữ liệu nến lấy trực tiếp từ API của bảy sàn CEX hoặc GeckoTerminal. TradingView chỉ dùng để đối chiếu một số tín hiệu đầu tiên nhằm xác nhận hai cách tính cho kết quả giống nhau.

Khi có PineScript mới, phần chuyển đổi tín hiệu sẽ được cập nhật riêng trong `lib/indicator.js`; cấu hình API và watchlist không cần thay đổi.

Engine SMC nằm riêng tại `public/smc.js` và chỉ nhận mảng OHLC chuẩn hóa, không phụ thuộc API sàn. Swing dùng pivot đối xứng 5 nến mỗi phía; Internal dùng 2 nến mỗi phía. Pivot chỉ được xác nhận sau khi đủ nến bên phải nhưng không vẽ ký tự H/L lên chart. BOS/CHoCH chỉ dùng giá đóng cửa của nến đã đóng. Order Block, FVG, EQH/EQL và Premium/Discount/Equilibrium cũng chỉ dùng dữ liệu đã đóng. Dealing range lấy cặp swing đã xác nhận gần nhất theo hướng cấu trúc và dùng mức 50% làm Equilibrium. Mỗi lớp có công tắc riêng; mặc định chỉ bật Swing Structure và tùy chọn được lưu trong trình duyệt.

## Chạy tự động và Telegram

1. Điền `TELEGRAM_BOT_TOKEN` vào `.env`, sau đó khởi động lại tool.
2. Trên Telegram, mở bot và gửi `/start`. Nếu gửi vào nhóm, thêm bot vào nhóm rồi gửi một tin nhắn trong nhóm.
3. Mở tab **Tự động & Telegram**, bấm **Tìm Chat ID**, chọn đúng chat rồi bấm **Gửi tin thử**.
4. Nạp watchlist CEX và/hoặc DEX. Nội dung được lưu trên chính máy chạy tool, có thể sửa và bấm **Lưu cấu hình** lại bất cứ lúc nào.
5. Chọn D1/W1, giờ chạy và bật **Chạy tự động**. Mặc định D1 là 07:10 giờ Việt Nam; W1 nên đặt sáng thứ Hai sau khi tuần UTC đóng.

Khi chạy theo lịch, tool chỉ gửi các tín hiệu BUY/SELL/BOTH mới và lưu khóa nến đã gửi để tránh gửi trùng. Hai nút **Chạy D1 ngay** và **Chạy W1 ngay** luôn gửi đầy đủ danh sách tín hiệu hiện tại để kiểm tra thủ công; các lần chạy thủ công không làm thay đổi lịch sử chống trùng của lịch tự động. Có thể bật/tắt bản tóm tắt không có tín hiệu và lỗi dữ liệu.

Cấu hình giao diện và lịch sử chống gửi trùng nằm trong `DATA_DIR`. Cấu hình schema v2 tách `assets.cex`, `assets.dex`, `assets.stocks` và lịch riêng cho crypto/stock. Stock đang tắt cho đến khi adapter SSI được hoàn thiện. Dữ liệu cấu hình v1 được tự chuyển đổi khi đọc.

Scheduler chạy bên trong tiến trình Node.js, vì vậy `npm start` phải luôn hoạt động. Giai đoạn triển khai máy chủ sẽ cấu hình PM2 để tự khởi động lại sau reboot.

Chi tiết vận hành nằm trong `NEXT_PHASE.md`.

## Coin mới và khung 8H

Tab **Coin mới** dùng watchlist riêng, không trộn với danh sách theo dõi điểm vào 7 ngày. Khi thêm, chỉ cần nhập mã coin (`HYPE`) hoặc cặp Spot (`HYPEUSDT`); server tự kiểm tra `Binance → OKX → Bybit`, chọn thị trường Spot đầu tiên đang giao dịch rồi ghim cố định định danh `sàn:cặp`. Coin không tự hết hạn và chỉ bị xóa khi người dùng chủ động xóa.

Mỗi dòng có thể mở trực tiếp chart 8H, sau đó chuyển sang 1H hoặc 4H để xem điểm vào. Trạng thái tạm dừng được lưu bền vững. Dữ liệu nằm trong `DATA_DIR/new-coin-watchlist.json`.

Chart 8H hiển thị cả nến đang chạy như chart D1. Trong 4 giờ đầu, nến tạm được dựng từ nến 4H hiện tại; trong 4 giờ sau, hệ thống ghép nến 4H đầu tiên đã đóng với nến 4H thứ hai đang chạy. Nến tạm chỉ dùng để hiển thị và EMA trực quan; Signal, SMC xác nhận và scheduler Telegram vẫn chỉ dùng nến đã đóng.

Candidate v3.0.1 quét các coin đang hoạt động tại `07:05 · 15:05 · 23:05` theo giờ Việt Nam, sau khi nến 8H đóng. Coin tạm dừng không gọi API sàn. Nút **Quét 8H & gửi Telegram** cho phép chạy thử ngay; chạy thủ công không làm thay đổi lịch sử chống gửi trùng của scheduler. Có thể đổi khung/lịch trong `config.json`:

```json
"newCoins": {
  "timeframe": "8H",
  "exchangePriority": ["BINANCE", "OKX", "BYBIT"],
  "scanHours": [7, 15, 23],
  "scanMinute": 5,
  "minimumCandles": 61
}
```

Các thông số thời gian cố định không chỉnh trên UI cũng nằm trong `config.json`:

```json
"automation": {
  "timezone": "Asia/Ho_Chi_Minh",
  "schedulerPollSeconds": 30
}
```

Giờ D1/W1 và phút quét danh sách theo dõi 4H/8H vẫn được chỉnh trực tiếp trên UI và lưu trong `DATA_DIR/automation.json`. Sau khi sửa `config.json`, cần restart PM2.

`minimumCandles: 61` tương ứng khoảng 20 ngày dữ liệu 8H và là ngưỡng tối thiểu để EMA55 cùng các điều kiện Pine hiện tại bắt đầu hợp lệ. Coin mới hơn ngưỡng này được giữ trong watchlist nhưng lượt quét sẽ báo `Thiếu dữ liệu`; chi tiết vẫn chỉ nằm trong log.

## GitHub và Linux

- GitHub Actions chạy `npm test` và `npm run check` trên mỗi push/pull request.
- PM2 dùng `ecosystem.config.cjs` và chỉ chạy một instance để scheduler không bị nhân đôi.
- Mẫu Nginx nằm trong `deploy/nginx-trading-signal.conf`; có thể bật thêm Basic Authentication như lớp bảo vệ thứ hai.
- Hướng dẫn triển khai nằm trong `deploy/README-LINUX.md`.
- Endpoint kiểm tra tiến trình: `GET /api/health`.

## Ý nghĩa loại tín hiệu

- BUY: `B`, `B4`, `B5`, `B6`, `BB`, `FR`, `BOTTOM`, `IN`, `TL`, `TL1`, `TL2`.
- SELL: `SS`, `SA`, `SSO`, `S2`, `FO`, `TS`.
- Cảnh báo `R` được giữ riêng và không tự xếp thành BUY.
- `EXT_LONG`, `EXT_SHORT`, `EMA_UP`, `EMA_DOWN` được tính để đối chiếu nhưng không tự biến thành lệnh BUY/SELL.

Chi tiết bản chuyển đổi Pine mới nhất nằm trong `docs/PINE_PORT.md`.

## Kiểm thử

```powershell
npm test
```

## Đối chiếu TradingView

Trên TradingView, chọn đúng sàn/pool được hiển thị trong kết quả, nến thường, đúng khung D1 hoặc W1 và thông số mặc định EMA 21/55, RSI 14/8, Swing 50. Scanner chuẩn hóa ngày và tuần theo UTC; riêng OKX sử dụng `1Dutc` thay vì nến ngày UTC+8 mặc định của sàn.

Mã chuyển đổi giữ giấy phép CC BY-NC-SA 4.0 và ghi nhận LuxAlgo theo mã Pine nguồn. Chỉ sử dụng phi thương mại; nếu phân phối bản sửa đổi phải giữ cùng giấy phép.
