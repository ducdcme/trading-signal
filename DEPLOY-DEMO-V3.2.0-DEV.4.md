# Deploy Trading Signal v3.2.0-dev.4 lên VPS demo

## 1. Upload từ PowerShell

```powershell
scp .\trading-signal-v3.2.0-dev.4.zip root@YOUR_VPS_IP:/opt/UpdateVersion/
```

## 2. Giải nén và kiểm thử

```bash
cd /opt/UpdateVersion
sudo unzip -oq trading-signal-v3.2.0-dev.4.zip
cd /opt/UpdateVersion/trading-signal-v3.2.0-dev.4
npm test
npm run check
```

## 3. Chép vào ứng dụng demo

Đặt đúng đường dẫn source demo hiện có trước khi chạy:

```bash
DEMO_APP_DIR=/var/www/trading-signal-demo
sudo cp -a /opt/UpdateVersion/trading-signal-v3.2.0-dev.4/. "$DEMO_APP_DIR"/
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

Sau đó thay `trading-signal-demo` bằng đúng tên trong danh sách:

```bash
pm2 restart trading-signal-demo --update-env
pm2 logs trading-signal-demo --lines 80
```

## 5. Kiểm tra

Thay `DEMO_PORT` bằng port nội bộ của ứng dụng demo:

```bash
curl -s http://127.0.0.1:DEMO_PORT/api/health | python3 -m json.tool
curl -s http://127.0.0.1:DEMO_PORT/api/metals/latest | python3 -m json.tool
curl -s 'http://127.0.0.1:DEMO_PORT/api/chart/metals?product=XAU_USD&side=MID&timeframe=1D&limit=100' | python3 -m json.tool
```

Kết quả `/api/health` phải trả `3.2.0-dev.4`. Sau đó nghiệm thu trên giao diện:

1. Tab Vàng & Bạc hiển thị đủ 6 sản phẩm.
2. Bộ lọc Việt Nam/Thế giới đúng 3 sản phẩm mỗi nhóm.
3. Vàng/bạc Việt Nam mở được chart Giá mua và Giá bán.
4. XAU/XAG/USDVND mở chart MID.
5. Chart chỉ hiện D1/W1; EMA, Signal và SMC hoạt động.
