# Deploy Trading Signal v3.2.0-dev.5 lên VPS demo

## 1. Upload từ PowerShell

```powershell
scp .\trading-signal-v3.2.0-dev.5.zip root@YOUR_VPS_IP:/opt/UpdateVersion/
```

## 2. Giải nén và kiểm thử

```bash
cd /opt/UpdateVersion
sudo unzip -oq trading-signal-v3.2.0-dev.5.zip
cd /opt/UpdateVersion/trading-signal-v3.2.0-dev.5
npm test --offline
npm run check --offline
```

## 3. Chép vào ứng dụng demo

```bash
DEMO_APP_DIR=/var/www/mydinh
sudo cp -a /opt/UpdateVersion/trading-signal-v3.2.0-dev.5/. "$DEMO_APP_DIR"/
cd "$DEMO_APP_DIR"
```

Gói phát hành không chứa `.env` hoặc thư mục `data`, nên không ghi đè cấu hình bí mật và dữ liệu runtime hiện có. Đảm bảo `.env` vẫn có:

```text
METALS_API_URL=http://127.0.0.1:8787/
```

## 4. Restart PM2

```bash
pm2 restart trading-signal-test --update-env
pm2 logs trading-signal-test --lines 80
```

## 5. Kiểm tra

Thay `DEMO_PORT` bằng port nội bộ của ứng dụng demo:

```bash
curl -s http://127.0.0.1:DEMO_PORT/api/health | python3 -m json.tool
curl -s http://127.0.0.1:8787/latest | python3 -m json.tool
```

`/api/health` phải trả phiên bản `3.2.0-dev.5`. API `/api/metals/latest` của Trading Signal yêu cầu đăng nhập, vì vậy kiểm tra phần này trực tiếp trên giao diện demo.

Checklist nghiệm thu:

1. Mở **Vàng & Bạc → So sánh**.
2. Có đủ XAU/USD, USD/VND, vàng quy đổi, XAG/USD và bạc quy đổi.
3. Có ba dòng Vàng miếng SJC, Nhẫn trơn 9999 và Bạc 999.
4. Mỗi dòng hiển thị riêng chênh lệch mua và chênh lệch bán, gồm số tiền và tỷ lệ phần trăm.
5. Premium dương hiển thị màu cam; discount âm hiển thị màu xanh.
6. Hồi quy lại chart Việt Nam BUY/SELL và chart thế giới MID.
