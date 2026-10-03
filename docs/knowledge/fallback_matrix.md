# KI-002 — Fallback và đối soát

Trạng thái: UNVERIFIED. Ngày biên tập: 2026-10-03; chưa có ngày kiểm chứng.

## Phạm vi và nguồn hiện có

Chính sách -9007 thuộc CONST-02/03; trạng thái triển khai chưa kiểm chứng.

Nguồn tham khảo: project_full_bundle.md do người dùng cung cấp và các tài liệu dự án đã soạn. Chưa có log chạy, test report hoặc commit hiện hành để xác nhận triển khai/hợp đồng.

## Quy trình xác minh và yêu cầu đối chiếu

Lập ma trận: thiếu ID → đối soát; ID người khác → không ghi đè; đúng người nhưng thiếu quyền → từ chối; đúng người đủ quyền → hoàn tất phần được yêu cầu rồi commit; Cloud thành công DB lỗi → recovery; timeout bất định → lookup/đối soát trước retry. Không dùng khớp tên hoặc alias từ client để cấp quyền.

## Bằng chứng cần bổ sung

- Phát biểu cụ thể được kiểm tra và yêu cầu/CONST liên quan.
- Phiên bản code, môi trường, thời điểm, lệnh hoặc thao tác thực tế.
- Input tổng hợp, kỳ vọng, kết quả thực và artifact/log đã ẩn dữ liệu nhạy cảm.
- Kết luận giới hạn theo từng phát biểu; phần chưa kiểm chứng giữ UNVERIFIED.

Không thay trạng thái chỉ vì đã viết xong tài liệu hoặc đọc thấy một tên hàm trong code.
