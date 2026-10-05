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
## Bổ sung: Bộ kiểm thử Update Person Worker & Replay DLQ Suite (TASK-017 & TASK-018 & TASK-019)

Ngày kiểm thử: 2026-10-05. Môi trường: Node.js v25+, PostgreSQL 16, Redis DB 4, Bull Queue.
Lệnh thực thi: `node tests/test_update_dlq_replay_suite.js`

| TC | Kịch bản kiểm thử | Kết quả | Trạng thái |
| --- | --- | --- | --- |
| TC-01 | Parser: returnCode = 1 và "1" thành công với data dạng số (kể cả 0), null, object | returnCode = 1 / '1' thành công; data 0, null, object bảo toàn | PASS |
| TC-02 | Parser: returnCode = -9007, -103, 0 ném HanetApiError chứa đầy đủ mã lỗi | Chuyển thành HanetApiError với returnCode chuẩn | PASS |
| TC-03 | Parser: Thiếu returnCode nhưng có code=1 bị từ chối và ném HanetApiError | Không fallback sang code, trả returnCode: null | PASS |
| TC-04 | Parser: Từ chối boolean, array, object, chuỗi rỗng và số không nguyên (1.5, NaN) | Chặn coercion lỏng lẻo, ném HanetApiError | PASS |
| TC-05 | Parser: HTTP lỗi (400, 500, 502) dù body có returnCode: 1 vẫn ném HanetApiError | HTTP status lỗi luôn là lỗi, không thành công giả | PASS |
| TC-06 | Parser: Response không có HTTP status và body HTML được xử lý an toàn | Đặt httpStatus = null, isTransportError = true | PASS |
| TC-07 | Token Refresh: isAuthError phát hiện 401/-103 và dừng lại sau 1 lần retry | Dừng và ném lỗi khi refresh token thất bại | PASS |
| TC-08 | Sanitizer: Che Bearer token, token/secret dạng query, JSON và colon trong thông báo lỗi | Toàn bộ secret được redact [REDACTED] | PASS |
| TC-09 | Sanitizer: Loại bỏ HTML tags, ký tự điều khiển (\r\n\t) và cắt ngắn <= 150 ký tự | Thông điệp log sạch sẽ, an toàn | PASS |
| TC-10 | URL Helper: Chấp nhận Public URL hợp lệ, bảo toàn base path không nhân đôi slashes | Tạo URL chuẩn RFC 3986 với path segment mã hóa | PASS |
| TC-11 | URL Helper: Từ chối not-a-url, thiếu protocol và giao thức không hợp lệ (ftp, js) | Chặn URL sai cú pháp hoặc giao thức cấm | PASS |
| TC-12 | URL Helper: Chặn localhost, IPv4 loopback (127.0.0.1, 127.1, 0.0.0.0), IPv6 và IPv4-mapped | Chặn tất cả dạng loopback tránh lỗi HANET | PASS |
| TC-13 | URL Helper: Từ chối credentials (user:pass), query (?key=val) và fragment (#hash) | Chặn URL chứa thông tin nhạy cảm/query | PASS |
| TC-14 | URL Helper: Mã hóa ký tự đặc biệt trong filename và chặn path traversal (../../) | Path traversal bị cắt về basename an toàn | PASS |
| TC-15 | URL Helper: Production hoặc live HANET gọi thiếu Public URL ném ConfigurationError | Ném ConfigurationError, không fallback localhost | PASS |
| TC-16 | Lock Ownership: CLI B acquire thất bại KHÔNG THỂ xóa khóa của CLI A qua Lua script | Quyền sở hữu khóa nguyên tử, chỉ token khớp mới DEL | PASS |
| TC-17 | Lock Ownership: Khóa hết hạn đổi chủ mới, token chủ cũ không thể xóa khóa mới | Token cũ không xóa được khóa của chủ mới | PASS |
| TC-18 | Resilient Replay: Ghi nhận replay state và phát hiện ALREADY_ENQUEUED chống trùng lặp | Ghi nhận mapping bền vững, không tạo duplicate job | PASS |
| TC-19 | DLQ Payload: Chuẩn hóa payload jobData / originalData và bảo toàn personID dạng chuỗi | Chuẩn hóa an toàn, không ép personID thành Number | PASS |
| TC-20 | DLQ Payload: Phát hiện xung đột định danh giữa jobData và originalData (PAYLOAD_CONFLICT) | Ném PayloadValidationError khi dữ liệu mâu thuẫn | PASS |
| TC-21 | DLQ Payload: Từ chối job không nhận diện được loại (UNSUPPORTED_JOB_TYPE) | Không tự ý mặc định sang register_person_job | PASS |
| TC-22 | CLI: scripts/list_dlq_jobs.js chạy ở chế độ chỉ đọc, không start processor và exit code 0 | Bull client thuần túy, đóng kết nối sạch sẽ | PASS |
| TC-23 | CLI: scripts/replay_dlq_job.js trả exit code 1 khi DLQ job ID không tồn tại | Báo lỗi rõ ràng, exit code = 1 | PASS |
| TC-24 | Replay DLQ: Từ chối khi file ảnh bị mất (không enqueue, không xóa DLQ job) | Giữ nguyên DLQ job, exit code != 0 | PASS |
| TC-25 | Replay DLQ: Đồng bộ triad ảnh (imagePath, imageFilename, publicImageUrl), không dlq_dlq_ | Tái nạp job thành công với triad chuẩn hóa | PASS |
| TC-26 | Replay DLQ: Chống tranh chấp khi worker khác đang PROCESSING | Từ chối replay khi worker đang bận | PASS |
| TC-27 | Worker DB: Ghi kết quả DB thất bại làm rollback transaction (không nuốt lỗi) | Transaction atomic, rollback sạch sẽ | PASS |
| TC-28 | Worker DB: Không cập nhật nhầm hồ sơ khi alias_id và person_id không khớp | Chống sai lệch định danh chéo | PASS |

```
===============================================================
🎉 KẾT QUẢ: ĐÃ VƯỢT QUA 28/28 BÀI KIỂM THỬ UPDATE PERSON & DLQ REPLAY.
===============================================================
```

## Bổ sung: Bộ kiểm thử Hardening DLQ Payload & Data Integrity (TASK-020)

Ngày kiểm thử: 2026-10-05. Môi trường: Node.js v25+, Pure Unit Test.
Lệnh thực thi: `node tests/test_payload_normalization_hardening.js`

| TC | Kịch bản kiểm thử | Kết quả | Trạng thái |
| --- | --- | --- | --- |
| TC-01 | Không suy luận đè lên jobName đã khai báo (`delete_person_job` -> `UNSUPPORTED_JOB_TYPE`) | Chặn suy luận đè, ném lỗi đúng loại | PASS |
| TC-02 | Phát hiện xung đột giữa `update_person_job` và `operation_type: REGISTER_NEW` | Ném `OPERATION_TYPE_CONFLICT` | PASS |
| TC-03 | Phát hiện xung đột identifier trong cùng một object (`personID` vs `personId`) | Ném `PAYLOAD_CONFLICT` | PASS |
| TC-04 | Phát hiện xung đột identifier giữa các tầng (outer `personID` vs `jobData.personID`) | Ném `PAYLOAD_CONFLICT` | PASS |
| TC-05 | `parseStrictBoolean`: `isPhotoOnly: "false"` cho kết quả false chính xác | Strict Boolean parsing chuẩn | PASS |
| TC-06 | Từ chối identifier là object (`personID: { id: 123 }` -> `INVALID_IDENTIFIER_TYPE`) | Chặn `[object Object]` | PASS |
| TC-07 | `update_person_job` thiếu `personID` ném `MISSING_REQUIRED_PERSON_ID` | Bắt buộc `personID` khi update | PASS |
| TC-08 | Không tự động gán title: title là `null` nếu không khai báo (không mặc định "Học Sinh") | Giữ `title: null`, chống ghi đè DB | PASS |
| TC-09 | Hai nguồn có `personID` cùng giá trị khác kiểu (`123` vs `"123"`) coi là cùng identifier | Chuẩn hóa string an toàn | PASS |
| TC-10 | Identifier là chuỗi chỉ chứa khoảng trắng được coi là `null` | Trim chuỗi rỗng thành `null` | PASS |
| TC-11 | Nhiều `jobName` giống nhau ở các tầng khác nhau không bị coi là xung đột | Giữ `jobName` hợp lệ | PASS |
| TC-12 | Nhiều `jobName` khác nhau với ít nhất 1 job không hỗ trợ -> ưu tiên `UNSUPPORTED_JOB_TYPE` | Ưu tiên chặn job không hỗ trợ | PASS |
| TC-13 | `operation_type` khai báo ở `jobData`/`originalData` vẫn được thu thập và kiểm tra | Quét đa tầng toàn diện | PASS |
| TC-14 | `verifyAndSyncImageTriad` cho phép `update_person_job` không ảnh nếu không `isPhotoOnly` | Cho phép update info không ảnh | PASS |
| TC-15 | Payload có identifier là array hoặc boolean ném `INVALID_IDENTIFIER_TYPE` | Chặn kiểu dữ liệu sai | PASS |

```
========================================================================================
🎉 KẾT QUẢ: ĐÃ VƯỢT QUA 15/15 BÀI KIỂM THỬ HARDENING DLQ PAYLOAD HELPER.
========================================================================================
```



