# PineScript port

Nguồn đối chiếu hiện tại:

- Pine: `SMC SCAPLING`, Pine v5.
- Snapshot SHA-256: `b042e8f7d746deffb4b918828e27eab024e138767c2bbd5e5427472e13fc5cdb`.
- Giấy phép nguồn: CC BY-NC-SA 4.0, LuxAlgo + phần bổ sung DUCDC.

## Phân loại trong Trading Signal

- BUY: `B`, `B4`, `B5`, `B6`, `BB`, `FR`, `BOTTOM`, `IN`, `TL`, `TL1`, `TL2`.
- SELL: `SS`, `SA`, `SSO`, `S2`, `FO`, `TS`.
- Warning: `R` từ weak-hand/fake-rug/reversal setup.
- Exit: `EXT_LONG`, `EXT_SHORT`.
- Trend: `EMA_UP`, `EMA_DOWN`.

`EXIT` và `TREND` được tính và hiển thị để đối chiếu nhưng không tự đổi trạng thái thành BUY/SELL. Telegram tự động hiện chỉ gửi hàng có trạng thái BUY/SELL/BOTH; điều này tránh hiểu nhầm thoát short là tín hiệu mua mới.

Scanner chỉ truyền nến đã đóng vào indicator. Vì Pine gọi alert bằng điều kiện `[1]` ở đầu nến sau, kết quả scanner trên nến đóng gần nhất tương ứng với tín hiệu Pine vừa được xác nhận.

## Thay đổi so với port trước

- Bổ sung nhánh `sell_2[1]` trong `fake_rug1`.
- Bổ sung `TL1` và `TS` vào tín hiệu vào lệnh.
- Bổ sung `testLong3` vào cảnh báo `R`.
- Bổ sung `EXT_LONG`, `EXT_SHORT`, `EMA_UP`, `EMA_DOWN` để đối chiếu.

Trước khi bật lịch thật, cần đối chiếu một tập BUY và SELL trên TradingView với đúng sàn, khung D1/W1, loại nến thường và cùng dữ liệu điều chỉnh.
