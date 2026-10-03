# Knowledge Base Index — thanh_giuse_pc

Ngày biên tập: 2026-10-03.

## Trạng thái và bằng chứng

- `VERIFIED`: Một phát biểu cụ thể đã có bằng chứng kiểm tra truy xuất được, ghi rõ môi trường, phiên bản/commit, ngày chạy, phương pháp và giới hạn.
- `UNVERIFIED`: Chưa đủ bằng chứng cho phát biểu trong phạm vi cần áp dụng, có mâu thuẫn hoặc cần kiểm tra lại sau thay đổi.
- `DEPRECATED`: Hướng dẫn không còn áp dụng cho luồng chính; phải trỏ tới tài liệu thay thế.

## Mục lục

| Mã | Nội dung | Trạng thái triển khai/hợp đồng | Bằng chứng hiện có | Tài liệu |
| --- | --- | --- | --- | --- |
| KI-001 | Mã lỗi HANET | VERIFIED (Logic ứng dụng) | Xử lý PERMANENT_ERROR_CODES, mã -9007 và từ điển dịch lỗi tại `src/utils/hanetErrorMap.js` | docs/knowledge/hanet_api_errors.md |
| KI-002 | Đối soát và xử lý -9007 | VERIFIED | `handleFaceExistsFallback` trong `queueService.js`, TC-03 PASS trong test suite | docs/knowledge/fallback_matrix.md |
| KI-003 | Hợp đồng API phòng ban và nhân sự | VERIFIED (Wrapper) | `hanetService.js` bọc các endpoint `/person/register`, `/person/updateInfo`, `/department/add-person` | docs/knowledge/hanet_api_contracts.md |
| KI-004 | Alias ổn định | VERIFIED | `resolveDepartmentAndAlias` bảo toàn 100% alias, TC-01 PASS | docs/knowledge/alias_standard.md |
| KI-005 | Giữ ảnh, retry và DLQ | VERIFIED | Bỏ cleanup trong `finally`, đổi tên `dlq_...`, TC-05 & TC-07 PASS | docs/knowledge/image_lifecycle.md |
| KI-006 | Quyết định dùng PostgreSQL cho dữ liệu vận hành | VERIFIED | Migration 006, Transactional Outbox, bỏ phụ thuộc ghi CSV | docs/decisions/0001-kill-csv-layer.md |
| KI-007 | Camera trong Zalo WebView | UNVERIFIED | Hỗ trợ fallback tải ảnh từ album và input capture=user | docs/knowledge/zalo_webview_camera.md |

## Tương thích mã tri thức cũ

- KI-037: nội dung cũ “-9007 luôn thành công” hết hiệu lực; xem KI-002 và CONST-03.
- KI-038: yêu cầu CSV làm kho vận hành hết hiệu lực; xem ADR 0001.
- KI-039: định dạng CSV chỉ dùng tham khảo migration nếu có yêu cầu; không là schema vận hành.
- KI-040: thay tuyên bố camera Zalo hoạt động 100% bằng KI-007.
- KI-041: bảng mã cũ đối chiếu theo KI-001.
