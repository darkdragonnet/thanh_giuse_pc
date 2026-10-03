# Verification Evidence — Register Integrity

Trạng thái: PASSED (Bộ kiểm thử tích hợp tự động).
Ngày kiểm thử: 2026-10-03. Môi trường: Node.js v20+, PostgreSQL 16, Redis (DB 4), Bull Queue.

| TC / REG tương ứng | Kịch bản | Kỳ vọng | Lệnh đã chạy | Kết quả thực tế | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| TC-01 / REG-002 | Alias không đổi qua resolveDepartmentAndAlias | Giữ nguyên 100% alias, kể cả 00XX và chữ thường | `node tests/test_register_integrity_suite.js` | Alias được bảo toàn chính xác | PASS |
| TC-02 / REG-004 | Hai người trùng tên cùng lớp | Không gộp Cloud ID hoặc chọn hồ sơ theo tên; giữ 2 bản ghi riêng | `node tests/test_register_integrity_suite.js` | 2 bản ghi riêng biệt với 2 alias độc lập | PASS |
| TC-03 / REG-003 | -9007 thiếu ID không thành công giả | Đưa về REVIEW_REQUIRED, không đánh dấu SYNCED | `node tests/test_register_integrity_suite.js` | Status chuyển REVIEW_REQUIRED, throw UnrecoverableError | PASS |
| TC-04 / REG-006 | Thay ảnh mới không bị khóa idempotency cũ chặn | Cho phép tiếp nhận và xử lý yêu cầu thay ảnh mới | `node tests/test_register_integrity_suite.js` | Lock cũ được giải phóng, lock mới chiếm thành công | PASS |
| TC-05 / REG-008 | DLQ bảo toàn ảnh và cập nhật tham chiếu | Ảnh được đổi tên `dlq_...` và giữ nguyên file | `node tests/test_register_integrity_suite.js` | File tồn tại đúng đường dẫn DLQ | PASS |
| TC-06 / REG-009 | Outbox Dispatcher phục hồi yêu cầu PENDING | Redis lỗi tạm thời không làm mất yêu cầu; tự động nạp lại | `node tests/test_register_integrity_suite.js` | Outbox dispatcher nạp queue và cập nhật ENQUEUED | PASS |
| TC-07 / REG-007 | Upload file trả 404 chuẩn khi thiếu file | Không trả ảnh SVG 200 giả cho HANET | `node tests/test_register_integrity_suite.js` | 404 được trả về chính xác khi thiếu file | PASS |
| TC-08 / REG-010 | Tra cứu trạng thái Registration Request theo requestId | UI / API lấy được đúng trạng thái bền vững | `node tests/test_register_integrity_suite.js` | Trả đúng status và sync_status từ PostgreSQL | PASS |

## Chi tiết thực thi

```
===============================================================
🧪 BẮT ĐẦU KIỂM THỬ HỒI QUY: REGISTER INTEGRITY TEST SUITE
===============================================================
[TC-01] Alias không đổi qua resolveDepartmentAndAlias (giữ nguyên 00XX, chữ thường) ... ✅ PASS
[TC-02] Hai người trùng tên cùng lớp giữ 2 hồ sơ độc lập, không gộp alias ... ✅ PASS
[TC-03] -9007 thiếu PersonID chuyển sang REVIEW_REQUIRED, không báo thành công giả ... ✅ PASS
[TC-04] Thay ảnh mới không bị idempotency khóa cũ chặn ... ✅ PASS
[TC-05] DLQ bảo toàn file ảnh có tiền tố dlq_ và cập nhật tham chiếu ... ✅ PASS
[TC-06] Outbox Dispatcher phục hồi và nạp lại yêu cầu PENDING ... 📨 [Outbox Dispatcher] Đã phục hồi và nạp queue cho request_id: req_outbox_...
✅ PASS
[TC-07] Upload route trả 404 chính xác khi thiếu file ảnh (không trả SVG 200 giả) ... ✅ PASS
[TC-08] Tra cứu trạng thái Registration Request theo requestId trả đúng dữ liệu ... ✅ PASS
===============================================================
🎉 KẾT QUẢ: ĐÃ VƯỢT QUA 8/8 BÀI KIỂM THỬ TÍCH HỢP HỒI QUY.
===============================================================
```
