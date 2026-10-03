# Tasks — Register Integrity

Trạng thái: Đã triển khai và vượt qua bộ kiểm thử tích hợp hồi quy (`tests/test_register_integrity_suite.js`).

| Hoàn tất | Task | Công việc | REG | Phụ thuộc TASK | Bằng chứng hoàn tất |
| --- | --- | --- | --- | --- | --- |
| [x] | TASK-001 | Khảo sát repo, schema, views, package scripts và baseline test; ghi file thiếu. | Toàn bộ | Không | Đã đọc toàn bộ views, controller, services, migrations |
| [x] | TASK-002 | Clarify Q-01..Q-04 và cập nhật spec/plan/knowledge. | 001,003,004,005,007,008,009,010 | 001 | Backend xác minh danh tính, scope lớp; giữ alias và phân tách new/retake |
| [x] | TASK-003 | Xác minh hợp đồng HANET register/update/lookup/department, mã lỗi và hoàn tất tải ảnh. | 003,005,007 | 001 | hanetService và queueService xử lý lỗi returnCode và HTTP status |
| [x] | TASK-004 | Thiết kế/migration request, outbox, image metadata, version và mapping trạng thái. | 002,005,006,007,008,009,010 | 002,003 | Migration `migrations/006_register_integrity_outbox.sql` đã thực thi |
| [x] | TASK-005 | Thực hiện validation và quyền backend cho submit/status/replay. | 001,004,010 | 002,004 | Backend xác minh hồ sơ đích, không cho client ghi đè dữ liệu người khác |
| [x] | TASK-006 | Chuẩn hóa alias chỉ lúc tạo; xử lý collision không ghi đè. | 002,004 | 004,005 | Alias cũ bất biến; collision được kiểm tra và xử lý bằng random suffix |
| [x] | TASK-007 | Thực hiện transaction tiếp nhận và outbox dispatcher có recovery. | 005,009 | 004,005,006 | Transactional Outbox ghi nhận vào PostgreSQL, dispatcher tự nạp lại queue |
| [x] | TASK-008 | Thực hiện idempotency theo request và tuần tự hóa cùng hồ sơ. | 002,006 | 004,007 | Khóa theo requestId, cho phép thay ảnh mới mà không bị khóa 24h chặn |
| [x] | TASK-009 | Tách register/update và fallback -9007 có xác minh quyền/liên kết. | 001,003,004 | 003,005,008 | Phân nhánh tạo mới và cập nhật ảnh; -9007 thiếu ID chuyển REVIEW_REQUIRED |
| [x] | TASK-010 | Thực hiện checkpoint/đối soát lỗi từng phần và commit kết quả. | 003,005,009 | 007,009 | DB lỗi không bị nuốt; cập nhật trạng thái registration_requests |
| [x] | TASK-011 | Giữ ảnh theo tham chiếu; sửa worker cleanup, timer và GC. | 007 | 003,004,010 | Xóa delayed cleanup trong finally; chỉ dọn khi job hoàn tất thành công |
| [x] | TASK-012 | Bảo toàn DLQ và reconcile rename; replay có kiểm tra hạn/quyền/checksum. | 005,007,008 | 002,010,011 | Đổi tên dlq_... và cập nhật đúng đường dẫn trong job payload |
| [x] | TASK-013 | Thực hiện UI/status bền vững và xử lý mạng trên WebView. | 001,009,010 | 005,007,010 | Thêm endpoint `/register/status/:requestId` và `/api/register/status/:requestId` |
| [x] | TASK-014 | Chạy test hồi quy và tích hợp lỗi/concurrency cho toàn bộ REG. | Toàn bộ | 005..013 | Chạy thành công `node tests/test_register_integrity_suite.js` (8/8 PASS) |
| [ ] | TASK-015 | Kiểm tra trình duyệt/Zalo và hợp đồng HANET trên môi trường thực tế. | 003,005,007,010 | 003,013,014 | Phụ thuộc thiết bị vật lý / camera thực tế của người dùng |
| [x] | TASK-016 | Phân tích lại độ bao phủ và cập nhật evidence/knowledge/ADR/runbook. | Toàn bộ | 014,015 | Đã cập nhật evidence.md và knowledge.md |

## Phạm vi file đã hoàn thiện

- `migrations/006_register_integrity_outbox.sql`: Bảng `registration_requests` và `registration_outbox`.
- `src/controllers/personController.js`: Xác thực dữ liệu backend, Transactional Outbox, phân nhánh đăng ký/cập nhật ảnh và API tra cứu trạng thái.
- `src/services/queueService.js`: Bảo toàn aliasID, xử lý -9007 chuẩn mực, DLQ giữ đúng đường dẫn ảnh, Outbox Dispatcher.
- `src/services/idempotencyService.js`: Hỗ trợ requestId, xóa lock cũ khi thay ảnh mới.
- `src/routes/personRoutes.js`: Thêm route tra cứu trạng thái đăng ký.
- `src/app.js`: Sửa route `/uploads/:filename` trả 404 chuẩn, kích hoạt bộ quét Outbox định kỳ.
- `src/views/person/register_csv.ejs`: Bảo toàn `alias_id` khi chọn học sinh từ dropdown.
- `tests/test_register_integrity_suite.js`: 8 ca kiểm thử tích hợp hồi quy tự động.
