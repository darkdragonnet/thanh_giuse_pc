# KI-003 — Hợp đồng API

Trạng thái: UNVERIFIED. Ngày biên tập: 2026-10-03; chưa có ngày kiểm chứng.

## Phạm vi và nguồn hiện có

Mô tả cũ nói update/remove phòng ban dùng id, remove-person dùng personID. Đây là ứng viên cần xác minh, chưa là hợp đồng đã kiểm chứng.

Nguồn tham khảo: project_full_bundle.md do người dùng cung cấp và các tài liệu dự án đã soạn. Chưa có log chạy, test report hoặc commit hiện hành để xác nhận triển khai/hợp đồng.

## Quy trình xác minh và yêu cầu đối chiếu

Ghi bảng endpoint/method/encoding/field/kiểu dữ liệu/quyền/HTTP/returnCode/id response/timeout/retry/lookup. Kiểm tra cả đường 2xx và lỗi HTTP. Đối chiếu tên wrapper thực tế (bundle có updateByFaceUrl, không tự giả định updatePersonByFaceUrl). Kiểm chứng URL host và tín hiệu hoàn tất tải ảnh; không suy từ tên miền hoặc HTTP 200.

## Bằng chứng cần bổ sung

- Phát biểu cụ thể được kiểm tra và yêu cầu/CONST liên quan.
- Phiên bản code, môi trường, thời điểm, lệnh hoặc thao tác thực tế.
- Input tổng hợp, kỳ vọng, kết quả thực và artifact/log đã ẩn dữ liệu nhạy cảm.
- Kết luận giới hạn theo từng phát biểu; phần chưa kiểm chứng giữ UNVERIFIED.

Không thay trạng thái chỉ vì đã viết xong tài liệu hoặc đọc thấy một tên hàm trong code.
