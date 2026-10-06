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
| [x] | TASK-017 | Chuẩn hóa HanetApiError, stage logging worker update_person_job và cơ chế replay DLQ. | 003,005,007,008 | 012,014 | `tests/test_update_dlq_replay_suite.js` & `test_register_integrity_suite.js` (PASS) |
| [x] | TASK-018 | Tách module cấu hình không side effect, tạo CLI list/replay DLQ độc lập, URL parser dùng new URL(). | 003,005,007,008 | 017 | `src/config/queueConfig.js`, `urlHelper.js` |
| [x] | TASK-019 | Sửa quyền sở hữu khóa replay (Lua), replay có khả năng phục hồi (replay state), tách sanitizer/lockHelper/dlqPayloadHelper thuần túy, kiểm soát timeout và thoát tiến trình tự nhiên. | 003,005,007,008 | 018 | 28/28 tests trong `tests/test_update_dlq_replay_suite.js` & 8/8 tests trong `tests/test_register_integrity_suite.js` |
| [x] | TASK-020 | Harden toàn diện dlqPayloadHelper.js: chặn suy luận đè jobName, bắt xung đột operation_type, quét identifier đa tầng, parseStrictBoolean, từ chối sai kiểu, bắt buộc personID/aliasID, title mặc định null. | 003,005,007,008 | 019 | 15/15 tests trong `tests/test_payload_normalization_hardening.js` (Tổng cộng 51/51 tests PASS) |
| [x] | TASK-021 | Tách ý nghĩa dữ liệu ảnh: persons.face_url chỉ chứa Cloud CDN URL đã đối soát, không ghi URL uploads tạm vào DB; bảo toàn ảnh cũ khi thay ảnh PENDING/FAILED; đối soát Cloud qua getPersonByAliasID; sửa UI class_manager.ejs, transfer.ejs, register_csv.ejs (XSS escaping, getMemberDisplayState, fallback avatar, không suy diễn SYNCED); công cụ scripts/reconcile_face_urls.js (dry-run/apply với snapshot lock và transaction audit). | 001,003,005,007,008,010 | 020 | `tests/test_image_management_reconciliation.js` (32/32 PASS). |
| [x] | TASK-022 | Sửa luồng UPDATE_PHOTO theo hợp đồng HANET đã xác minh: POST /person/updateByFaceUrl gửi body url, aliasID, placeID; validation nghiêm ngặt trước HTTP; xử lý data.path và cờ needsReconciliation; phân nhánh thuần thay ảnh vs cập nhật metadata trong worker; pre-check hồ sơ DB và chống mâu thuẫn PersonID/AliasID; UPDATE_PHOTO không sửa name/title/dept và không gọi updateInfo; transaction DB ngắn có rowCount === 1 và audit log; checkpoint alreadyCommitted; bảo vệ ảnh tham chiếu active và file DLQ trong cleanupDelayed/GC. | 001,002,003,005,006,007,008 | 021 | `tests/test_update_photo_contract_suite.js` (9/9 PASS). Tổng cộng 92/92 tests PASS across 5 suites. |

## Phạm vi file đã hoàn thiện

- `src/services/hanetService.js`: Sửa `updateByFaceUrl` gửi đúng trường `url` (không gửi `faceUrl`/`fileUrl`), validate input chặt chẽ, kiểm tra `isVerifiedHanetCdnUrl(data.path)`, trả về `needsReconciliation` khi URL thiếu hoặc sai CDN domain.
- `src/services/queueService.js`: Sửa worker `update_person_job` phân nhánh rõ ràng giữa `isPurePhotoUpdate` (`UPDATE_PHOTO`) và cập nhật metadata; pre-check PostgreSQL trước khi gọi mạng; không gọi `updateInfo` khi `UPDATE_PHOTO`; checkpoint `alreadyCommitted`; commit DB ngắn với `rowCount === 1` và lưu `audit_logs`.
- `src/services/imageService.js`: Bổ sung `isImageReferenced` kiểm tra liên kết từ `registration_requests` (`ACCEPTED`/`PROCESSING`), `registration_outbox` (`PENDING`) và bảo tồn vĩnh viễn file có tiền tố `dlq_`.
- `tests/test_update_photo_contract_suite.js`: 9 ca kiểm thử hợp đồng `UPDATE_PHOTO`, bảo toàn metadata, concurrency lock, rollback và checkpoint.

- `migrations/006_register_integrity_outbox.sql`: Bảng `registration_requests` và `registration_outbox`.
- `src/config/queueConfig.js`: Cấu hình Bull/Redis dùng chung không side-effect (không import express, worker, outbox, cron).
- `src/utils/sanitizer.js`: Module thuần túy làm sạch chuỗi, che giấu Bearer/Query/JSON secrets, loại bỏ HTML/control char, giới hạn độ dài.
- `src/utils/lockHelper.js`: Helper quản lý Distributed Lock nguyên tử bằng Lua Scripts (`acquireReplayLock`, `releaseReplayLock`, `extendReplayLock`), chỉ chủ sở hữu token mới có quyền DEL/EXPIRE.
- `src/utils/dlqPayloadHelper.js`: Module thuần túy chuẩn hóa payload `jobData`/`originalData`, phát hiện xung đột dữ liệu, bảo toàn `personID` dạng chuỗi, xác minh triad ảnh an toàn.
- `src/utils/urlHelper.js`: Module chuẩn hóa Public URL dựa trên `new URL()`, bổ sung `isVerifiedHanetCdnUrl` (kiểm tra hostname CDN: `static.hanet.ai`, `vcdn-static.hanet.ai`, `hanet-static.vcdn.vn`, `vcdn.hanet.ai`), `isUploadsUrl`, `sanitizeImageUrl`.
- `src/services/hanetService.js`: Lớp `HanetApiError` bảo toàn endpoint, httpStatus, returnCode, returnMessage (sanitized); parser nghiêm ngặt `returnCode === 1`, giới hạn 1 lần refresh token.
- `src/services/queueService.js`: Stage logging, worker và fallback -9007 tự động đối soát avatar CDN qua `getPersonByAliasID`, chỉ lưu CDN URL hợp lệ vào `persons.face_url`, bảo toàn URL Cloud cũ khi thất bại.
- `src/controllers/personController.js`: `handleRegister`, `handleUpdate`, `triggerSync` tuyệt đối không ghi `publicImageUrl` (/uploads/...) vào `persons.face_url`; truyền `sync_status` sang view.
- `src/views/class_manager.ejs`: Tách bạch `hasCloudReference` vs `syncStatus`, badge chuẩn ("Đã đồng bộ", "Cập nhật thất bại", "Cần đối soát", "Đang xử lý", "Chưa đồng bộ"), escaping chống XSS toàn diện (name, title, class, alias), avatar fallback onerror an toàn.
- `src/views/transfer.ejs`: Không gán "HANET Sync" giả tạo khi chỉ có `alias_id`; escape dữ liệu hiển thị; xác minh CDN URL.
- `src/views/person/register_csv.ejs`: Phân biệt chính xác trạng thái "Đã có Face ID", "Lỗi cập nhật", "Đang xử lý", fallback `onerror` an toàn, không hiện badge xanh giả tạo khi FAILED.
- `scripts/reconcile_face_urls.js`: CLI đối soát và khôi phục Cloud Face URL từ HANET AI Cloud theo internal IDs, mặc định `--dry-run`, hỗ trợ `--apply` với transaction + snapshot concurrency lock và rollback audit.
- `scripts/list_dlq_jobs.js`: CLI chỉ đọc DLQ, không khởi động processor/worker phụ, đóng kết nối sạch sẽ trong `finally`.
- `scripts/replay_dlq_job.js`: CLI tái nạp job DLQ producer-only, khóa chống tranh chấp Lua token, lưu trữ liên kết bền vững `idempotency:dlq_replay_state:<id>`, phân biệt chính xác các exit codes.
- `src/services/idempotencyService.js`: Hỗ trợ requestId, xóa lock cũ khi thay ảnh mới.
- `src/routes/personRoutes.js`: Thêm route tra cứu trạng thái đăng ký.
- `src/app.js`: Sửa route `/uploads/:filename` trả 404 chuẩn, kích hoạt bộ quét Outbox định kỳ.
- `tests/test_register_integrity_suite.js`: 8 ca kiểm thử tích hợp hồi quy tự động (8/8 PASS).
- `tests/test_update_dlq_replay_suite.js`: 28 ca kiểm thử toàn diện cho parser, sanitizer, URL helper, atomic lock, payload helper, CLI scripts và worker integrity (28/28 PASS).
- `tests/test_payload_normalization_hardening.js`: 15 ca kiểm thử chuẩn hóa payload DLQ (15/15 PASS).
- `tests/test_image_management_reconciliation.js`: 24 ca kiểm thử toàn diện quản lý ảnh, bảo toàn Cloud avatar, logic UI an toàn và đối soát dữ liệu CLI (24/24 PASS).


