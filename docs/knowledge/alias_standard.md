# KI-004 — Alias ổn định

Trạng thái: UNVERIFIED. Ngày biên tập: 2026-10-03; chưa có ngày kiểm chứng.

## Phạm vi và nguồn hiện có

Chuẩn alias mới là chính sách CONST-02, không xác nhận worker hiện tại tuân thủ.

Nguồn tham khảo: project_full_bundle.md do người dùng cung cấp và các tài liệu dự án đã soạn. Chưa có log chạy, test report hoặc commit hiện hành để xác nhận triển khai/hợp đồng.

## Quy trình xác minh và yêu cầu đối chiếu

Ba phần có dấu gạch dưới, mã phòng ban và lớp chuẩn hóa, token 4 ký tự A-Z0-9. Chốt chuẩn ký tự lớp/dấu phân cách/giới hạn chiều dài tại một nguồn. Sinh trước lưu/enqueue, constraint duy nhất và retry collision có giới hạn. Không đổi alias hiện hữu. Kiểm tra hậu tố 00XX, chữ thường, lớp có dấu/khoảng trắng/underscore và request đồng thời.

## Bằng chứng cần bổ sung

- Phát biểu cụ thể được kiểm tra và yêu cầu/CONST liên quan.
- Phiên bản code, môi trường, thời điểm, lệnh hoặc thao tác thực tế.
- Input tổng hợp, kỳ vọng, kết quả thực và artifact/log đã ẩn dữ liệu nhạy cảm.
- Kết luận giới hạn theo từng phát biểu; phần chưa kiểm chứng giữ UNVERIFIED.

Không thay trạng thái chỉ vì đã viết xong tài liệu hoặc đọc thấy một tên hàm trong code.
