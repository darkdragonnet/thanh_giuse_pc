# KI-005 — Vòng đời ảnh

Trạng thái: UNVERIFIED. Ngày biên tập: 2026-10-03; chưa có ngày kiểm chứng.

## Phạm vi và nguồn hiện có

Yêu cầu CONST-04 bao gồm worker, timer, GC và replay. Chưa có test thực tế.

Nguồn tham khảo: project_full_bundle.md do người dùng cung cấp và các tài liệu dự án đã soạn. Chưa có log chạy, test report hoặc commit hiện hành để xác nhận triển khai/hợp đồng.

## Quy trình xác minh và yêu cầu đối chiếu

Theo dõi request/consumer, đường dẫn, checksum, trạng thái, hạn giữ. Giữ ảnh lúc active/waiting/retry/DLQ còn quyền replay. Kiểm tra lại trước delete; 30 giây là tối thiểu sau điều kiện dọn. Rename dlq_ cập nhật tham chiếu và reconcile crash. Phân biệt file upload gốc và processed. Kiểm chứng cấu hình Sharp 1280x738 contain JPEG 90 với đầu vào EXIF/HEIC; không gọi đây là yêu cầu API chính thức nếu chưa có nguồn.

## Bằng chứng cần bổ sung

- Phát biểu cụ thể được kiểm tra và yêu cầu/CONST liên quan.
- Phiên bản code, môi trường, thời điểm, lệnh hoặc thao tác thực tế.
- Input tổng hợp, kỳ vọng, kết quả thực và artifact/log đã ẩn dữ liệu nhạy cảm.
- Kết luận giới hạn theo từng phát biểu; phần chưa kiểm chứng giữ UNVERIFIED.

Không thay trạng thái chỉ vì đã viết xong tài liệu hoặc đọc thấy một tên hàm trong code.
