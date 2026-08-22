# Phát hành Trading Signal v3.2.0

## 1. Cập nhật repository trên Mac

Tải `trading-signal-v3.2.0.zip` về thư mục `Downloads`, sau đó mở Terminal:

```bash
REPO_DIR="/Users/mrducdc/Library/CloudStorage/Dropbox/Workspace/NodeJS/trading-signal"
RELEASE_DIR="$(mktemp -d)"

unzip -q "$HOME/Downloads/trading-signal-v3.2.0.zip" -d "$RELEASE_DIR"
cd "$REPO_DIR"
git status --short
git branch --show-current
git pull --ff-only
```

`git status --short` phải không có kết quả. Nếu đang có file sửa hoặc file mới chưa commit, dừng tại đây để lưu phần việc đó trước.

Chép bản phát hành vào repository nhưng không đụng `.env`, dữ liệu runtime hoặc `node_modules`:

```bash
rsync -av \
  --exclude='.env' \
  --exclude='data/' \
  --exclude='node_modules/' \
  "$RELEASE_DIR/trading-signal-v3.2.0/" \
  "$REPO_DIR/"

cd "$REPO_DIR"
npm test
npm run check
git diff --check
git status --short
```

Kết quả yêu cầu: 134/134 test đạt và kiểm tra cú pháp đạt. Sau khi xem danh sách thay đổi:

```bash
git add -A
git commit -m "Release Trading Signal v3.2.0"
git tag -a v3.2.0 -m "Trading Signal v3.2.0"
git push origin HEAD
git push origin v3.2.0
```

Nếu tag `v3.2.0` đã tồn tại, không ghi đè tag; kiểm tra bằng `git show v3.2.0` trước khi xử lý tiếp.

## 2. Cập nhật VPS production

Collector phải đang chạy tại `http://127.0.0.1:8787/` và `.env` của Trading Signal phải có:

```dotenv
METALS_API_URL=http://127.0.0.1:8787/
```

Trên VPS:

```bash
cd /var/www/trading-signal
git status --short
git branch --show-current
git pull --ff-only
npm test
npm run check
pm2 reload trading-signal --update-env
pm2 save
curl -s http://127.0.0.1:3210/api/health | python3 -m json.tool
pm2 logs trading-signal --lines 100 --nostream
```

`git status --short` phải trống trước khi pull. Không dùng `git reset --hard` nếu server có thay đổi cục bộ.

Health phải trả `version: 3.2.0`. Chỉ chạy một instance PM2 vì scheduler nằm trong tiến trình Node.js.

## 3. Nghiệm thu sau cập nhật

1. Đăng nhập domain production và xác nhận bốn nhóm tab cấp 1 cùng các tab con đúng cấu trúc v3.2.0.
2. Mở **Vàng & Bạc → Việt Nam**, kiểm tra ba sản phẩm và chart D1/W1.
3. Mở **Thế giới** và **So sánh**, xác nhận XAU, XAG, USD/VND và phép quy đổi hiển thị đủ.
4. Mở **Tự động & Telegram**, xác nhận lịch Vàng–Bạc D1 vẫn ở trạng thái mong muốn sau migration.
5. Chạy tay **Vàng–Bạc SELL D1** một lần; kết quả chỉ gồm Vàng miếng SJC, Nhẫn trơn 9999 và Bạc 999.
6. Không bật cảnh báo BUY, XAU, XAG hoặc USD/VND.

Chạy tay không ghi khóa chống trùng. Scheduler chỉ ghi khóa sau khi bản tin Telegram gộp được gửi thành công.
