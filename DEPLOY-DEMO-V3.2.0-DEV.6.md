# Deploy Trading Signal v3.2.0-dev.6 lên VPS demo

## 1. Upload từ PowerShell

```powershell
scp .\trading-signal-v3.2.0-dev.6.zip root@YOUR_VPS_IP:/opt/UpdateVersion/
```

## 2. Giải nén và kiểm thử

```bash
cd /opt/UpdateVersion
sudo unzip -oq trading-signal-v3.2.0-dev.6.zip
cd /opt/UpdateVersion/trading-signal-v3.2.0-dev.6
npm test --offline
npm run check --offline
```

## 3. Chép vào ứng dụng demo

```bash
sudo cp -a \
  /opt/UpdateVersion/trading-signal-v3.2.0-dev.6/. \
  /var/www/mydinh/

cd /var/www/mydinh
pm2 restart trading-signal-test --update-env
pm2 logs trading-signal-test --lines 80
```

Gói phát hành không chứa `.env` hoặc thư mục `data`, nên giữ nguyên xác thực, Telegram, watchlist và trạng thái chống trùng hiện có.

## 4. Kiểm tra phiên bản

Thay `DEMO_PORT` bằng port nội bộ của ứng dụng demo:

```bash
curl -s http://127.0.0.1:DEMO_PORT/api/health | python3 -m json.tool
```

Kết quả phải trả `3.2.0-dev.6`.

## 5. Nghiệm thu chạy tay

1. Đăng nhập trang demo và mở **Tự động & Telegram**.
2. Kiểm tra dòng lịch **Vàng–Bạc D1** đang tắt sau khi nâng cấp và thời gian mặc định là `07:10`.
3. Bấm **Chạy Vàng–Bạc SELL D1**.
4. Kết quả phải ghi đã quét đúng `3` sản phẩm.
5. Telegram phải chỉ nhắc Vàng miếng SJC, Nhẫn trơn 9999 và Bạc 999; không được có BUY, XAU, XAG hoặc USD/VND.
6. Nếu có tín hiệu, giá phải được ghi là **Giá bán đóng** theo VND.
7. Chạy tay lần thứ hai vẫn trả đầy đủ tín hiệu hiện tại và không ghi khóa chống trùng.

## 6. Nghiệm thu scheduler

Để test ngay, có thể tạm đặt lịch Vàng–Bạc D1 ở một phút sắp tới, bật **Bật chạy tự động**, bật **Vàng–Bạc D1** rồi lưu. Sau khi kiểm tra xong, trả lịch về `07:10`.

- Khi không có tín hiệu, bản tin tự động chỉ chứa thống kê lượt quét.
- Nếu trùng giờ với Crypto D1, hai phần phải nằm trong cùng một bản tin Telegram.
- Chỉ sau khi bản tin gộp gửi thành công mới ghi khóa chống gửi trùng.
- Lỗi Telegram chỉ hiển thị loại và số lượng; chi tiết exception phải nằm trong log PM2.
