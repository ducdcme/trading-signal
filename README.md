# Trading Signal

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

Chỉ cần nhập tên coin, ví dụ `MNT` hoặc `PI`. Với mỗi sàn, tool ưu tiên USDT rồi fallback USDC:

1. Binance: `<COIN>USDT` → `<COIN>USDC`
2. Bybit: `<COIN>USDT` → `<COIN>USDC`
3. OKX: `<COIN>-USDT` → `<COIN>-USDC`

Sàn đầu tiên có cặp Spot và ít nhất 100 nến ngày đã đóng sẽ được sử dụng. Có thể đổi thứ tự trong `exchangePriority` của `config.json`.

Nếu muốn ép dùng một sàn, nhập `BYBIT:MNT`, `OKX:PI` hoặc `BINANCE:BTC`.

Các API đều là API dữ liệu thị trường công khai, không cần API key:

- Binance: `/api/v3/klines`
- Bybit V5: `/v5/market/kline`, `category=spot`, `interval=D`
- OKX V5: `/api/v5/market/history-candles`, `bar=1Dutc`

Quyền truy cập Bybit hoặc OKX có thể phụ thuộc mạng và khu vực của máy đang chạy tool. Khi một API bị chặn, kết quả sẽ ghi rõ lỗi của từng sàn đã thử.

Khi chọn file `.txt`, danh sách trong file sẽ thay nội dung ô nhập. Sau đó vẫn có thể sửa, xóa hoặc thêm coin mới trước khi bấm **Quét tín hiệu**. File chỉ được đọc trong trình duyệt và không được tải lên máy chủ khác.

Có thể thử ngay bằng file `sample-watchlist.txt` đi kèm dự án.

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

Tool không tự động điều khiển TradingView. Công thức Pine đã được chuyển sang JavaScript và chạy trên dữ liệu nến lấy trực tiếp từ API của Binance, Bybit, OKX hoặc GeckoTerminal. TradingView chỉ dùng để đối chiếu một số tín hiệu đầu tiên nhằm xác nhận hai cách tính cho kết quả giống nhau.

Khi có PineScript mới, phần chuyển đổi tín hiệu sẽ được cập nhật riêng trong `lib/indicator.js`; cấu hình API và watchlist không cần thay đổi.

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
