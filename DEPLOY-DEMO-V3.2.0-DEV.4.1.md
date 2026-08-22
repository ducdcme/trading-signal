# Deploy Trading Signal v3.2.0-dev.4.1 lên VPS demo

## 1. Upload từ PowerShell

```powershell
scp .\trading-signal-v3.2.0-dev.4.1.zip root@YOUR_VPS_IP:/opt/UpdateVersion/
```

## 2. Giải nén và kiểm thử

```bash
cd /opt/UpdateVersion
sudo unzip -oq trading-signal-v3.2.0-dev.4.1.zip
cd /opt/UpdateVersion/trading-signal-v3.2.0-dev.4.1
npm test
npm run check
```

## 3. Chép vào ứng dụng demo

Đặt đúng đường dẫn source demo hiện có trước khi chạy:

```bash
DEMO_APP_DIR=/var/www/mydinh
sudo cp -a /opt/UpdateVersion/trading-signal-v3.2.0-dev.4.1/. "$DEMO_APP_DIR"/
cd "$DEMO_APP_DIR"
```

Lệnh trên không chứa `.env` hoặc thư mục `data`, nên không ghi đè cấu hình bí
mật và dữ liệu runtime hiện có.

Mở `.env` của bản demo:

```bash
sudo nano "$DEMO_APP_DIR/.env"
```

Đảm bảo có dòng:

```text
METALS_API_URL=http://127.0.0.1:8787/
```

## 4. Restart PM2

Xem đúng tên process demo:

```bash
pm2 list
```

```bash
pm2 restart trading-signal-test --update-env
pm2 logs trading-signal-test --lines 80
```

## 5. Kiểm tra

Thay `DEMO_PORT` bằng port nội bộ của ứng dụng demo:

```bash
curl -s http://127.0.0.1:DEMO_PORT/api/health | python3 -m json.tool
curl -s http://127.0.0.1:DEMO_PORT/api/metals/latest | python3 -m json.tool
curl -s 'http://127.0.0.1:DEMO_PORT/api/chart/metals?product=XAU_USD&side=MID&timeframe=1D&limit=100' | python3 -m json.tool
```

Kết quả `/api/health` phải trả `3.2.0-dev.4.1`. Sau đó nghiệm thu trên giao diện:

1. Điều hướng cấp 1 hiển thị Crypto, Vàng & Bạc, Chứng khoán Việt Nam, Tự động & Telegram.
2. Vàng & Bạc có các tab con Tổng quan, Việt Nam, Thế giới và So sánh.
3. Vàng/bạc Việt Nam mở được chart Giá mua và Giá bán.
4. XAU/XAG/USDVND mở chart MID.
5. Chart chỉ hiện D1/W1; EMA, Signal và SMC hoạt động.
