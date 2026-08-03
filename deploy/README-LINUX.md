# Deploy Trading Signal trên Linux

## 1. Chuẩn bị source và dữ liệu

```bash
sudo install -d -m 750 -o "$USER" -g "$USER" /var/www/trading-signal
git clone YOUR_GITHUB_REPOSITORY_URL /var/www/trading-signal
cd /var/www/trading-signal
cp .env.example .env
sudo install -d -m 750 -o "$USER" -g "$USER" /var/lib/trading-signal
```

Sửa `.env`:

```dotenv
HOST=127.0.0.1
PORT=3210
DATA_DIR=/var/lib/trading-signal
TELEGRAM_BOT_TOKEN=YOUR_TOKEN
TELEGRAM_CHAT_ID=
```

Không đưa `.env` lên GitHub.

Tạo thông tin đăng nhập:

```bash
npm run generate-auth
```

Sao chép bốn dòng `AUTH_*` được tạo vào `.env`. Production sẽ không khởi động nếu thiếu các dòng này.

## 2. Kiểm tra và chạy bằng PM2

```bash
npm test
npm run check
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Chạy đúng lệnh `sudo ...` mà `pm2 startup` in ra, sau đó `pm2 save` lại. Chỉ chạy **một instance** vì scheduler nằm trong tiến trình Node.js.

Kiểm tra:

```bash
curl http://127.0.0.1:3210/api/health
pm2 logs trading-signal
```

## 3. Nginx và HTTPS

```bash
sudo cp deploy/nginx-trading-signal.conf /etc/nginx/sites-available/trading-signal
sudo ln -s /etc/nginx/sites-available/trading-signal /etc/nginx/sites-enabled/trading-signal
sudo nginx -t
sudo systemctl reload nginx
```

Cấu hình đi kèm đã đặt `server_name trading.abc.net`. Nếu domain này đã có một `server` block khác, không tạo block trùng; hãy đưa phần `location`/`proxy_pass` của file mẫu vào block hiện có và bỏ cấu hình `root` tĩnh cho location `/`.

Sau khi kiểm tra HTTP, bật HTTPS bằng hệ thống SSL đang dùng trên server. Nếu server đang dùng Certbot với Nginx:

```bash
sudo certbot --nginx -d trading.abc.net
```

Cookie production luôn có cờ `Secure`, vì vậy đăng nhập chính thức tại <https://trading.abc.net>.

Ứng dụng đã có trang đăng nhập. Nếu muốn thêm Basic Authentication của Nginx làm lớp thứ hai:

```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd-trading-signal YOUR_LOGIN_NAME
```

Sau đó bỏ dấu `#` ở hai dòng `auth_basic` trong file Nginx.

## 4. Cập nhật phiên bản sau

```bash
cd /var/www/trading-signal
git pull --ff-only
npm test
npm run check
pm2 reload trading-signal
```

Watchlist và lịch sử Telegram nằm trong `DATA_DIR`, nên không bị ảnh hưởng bởi `git pull`.
