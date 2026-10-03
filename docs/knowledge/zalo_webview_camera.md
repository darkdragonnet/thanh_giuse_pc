# KI-007 — Camera Zalo/WebView

Trạng thái: UNVERIFIED. Ngày biên tập: 2026-10-03; chưa có ngày kiểm chứng.

## Phạm vi và nguồn hiện có

Chưa có bằng chứng tương thích thiết bị. Không cam kết hoạt động 100%.

Nguồn tham khảo: project_full_bundle.md do người dùng cung cấp và các tài liệu dự án đã soạn. Chưa có log chạy, test report hoặc commit hiện hành để xác nhận triển khai/hợp đồng.

## Quy trình xác minh và yêu cầu đối chiếu

Thử camera và chọn ảnh dự phòng; ghi OS/device/browser/Zalo version, quyền camera, HTTPS, EXIF/HEIC, ảnh lớn, hủy chọn, từ chối quyền, submit lặp, reload và mạng yếu. capture=user là gợi ý của trình duyệt, không bảo đảm mở camera trước. Giữ khả năng chọn ảnh khi camera trực tiếp không khả dụng.

## Bằng chứng cần bổ sung

- Phát biểu cụ thể được kiểm tra và yêu cầu/CONST liên quan.
- Phiên bản code, môi trường, thời điểm, lệnh hoặc thao tác thực tế.
- Input tổng hợp, kỳ vọng, kết quả thực và artifact/log đã ẩn dữ liệu nhạy cảm.
- Kết luận giới hạn theo từng phát biểu; phần chưa kiểm chứng giữ UNVERIFIED.

Không thay trạng thái chỉ vì đã viết xong tài liệu hoặc đọc thấy một tên hàm trong code.
