# Security

- Không commit `.env`, token Telegram, API key, Chat ID hoặc dữ liệu runtime.
- Server Node.js mặc định chỉ bind `127.0.0.1`.
- Khi truy cập qua Internet, đặt ứng dụng sau HTTPS và lớp xác thực của Nginx, VPN hoặc giới hạn IP.
- Không chạy nhiều instance vì mỗi instance có scheduler riêng.
- Production không khởi động nếu thiếu `AUTH_USERNAME`, `AUTH_PASSWORD_HASH` hoặc `AUTH_SESSION_SECRET`.
- Mật khẩu được băm bằng scrypt; phiên đăng nhập dùng cookie `HttpOnly`, `SameSite=Strict` và `Secure`.
- Đăng nhập sai bị giới hạn theo địa chỉ IP. Các request thay đổi dữ liệu phải cùng origin.
- Nếu token bị lộ, thu hồi token tại BotFather và tạo token mới trước khi khởi động lại ứng dụng.

Không gửi secret trong issue công khai. Khi báo lỗi, xóa token, Chat ID, contract riêng và địa chỉ server khỏi log hoặc ảnh chụp.
